# Certificate Service Integration with Smart Fallback

## Summary

Integrate Toppan certificate-service with **intelligent template-based routing**:
- If feature flag enabled AND template exists → Use certificate-service (with QR + signature)
- Otherwise → Fall back to existing client-side generation

**Single handler for ALL certificate types** with conditional logic.

## Architecture

```typescript
// Universal handler for all certificate types
async function printCertificateHandler(request, h) {
  const { event, action } = request.payload

  // Check feature flag
  if (!USE_TOPPAN_CERTIFICATE_SERVICE) {
    return h.response().code(200)  // Client-side generation
  }

  // Check if template exists for this certificate type
  const templateName = getTemplateName(event.type, action.certificate.certificateTemplateId)
  const hasTemplate = await checkTemplateExists(templateName)

  if (!hasTemplate) {
    console.log(`Template ${templateName} not found, falling back to client-side`)
    return h.response().code(200)  // Client-side generation
  }

  // Template exists - use certificate-service
  try {
    const pdf = await generateWithCertificateService(event, action)
    return h.response({ pdfBase64: pdf.base64 }).code(200)
  } catch (error) {
    console.error('Certificate service failed, falling back to client-side')
    return h.response().code(200)  // Fallback on error
  }
}
```

## Decision Flow

```
PRINT_CERTIFICATE action received
  ↓
┌─────────────────────────┐
│ Feature flag enabled?   │
└──────────┬──────────────┘
           │
    NO ←───┤───→ YES
    │              │
    ↓              ↓
[Client-side]  ┌─────────────────────────┐
[generation]   │ Template exists in      │
               │ certificate-service?    │
               └──────────┬──────────────┘
                          │
                   NO ←───┤───→ YES
                   │              │
                   ↓              ↓
            [Client-side]  ┌─────────────────────────┐
            [generation]   │ Certificate-service     │
                          │ available?              │
                          └──────────┬──────────────┘
                                     │
                              NO ←───┤───→ YES
                              │              │
                              ↓              ↓
                       [Client-side]  [Server-side PDF
                       [generation]    with QR + sig]
```

## Implementation

### Step 1: Template Configuration

```typescript
// /home/ktsang/opencrvs-countryconfig-atg/src/api/print-certificate/templates.ts

export const CERTIFICATE_SERVICE_TEMPLATES = {
  'birth-certificate': 'antigua-birth-v1',
  'birth-certificate-certified-copy': 'antigua-birth-v1',
  // Add more as templates become available:
  // 'death-certificate': 'antigua-death-v1',
  // 'marriage-certificate': 'antigua-marriage-v1'
}

export function getTemplateName(eventType: string, templateId: string): string | null {
  return CERTIFICATE_SERVICE_TEMPLATES[templateId] || null
}

export function hasTemplateSupport(templateId: string): boolean {
  return templateId in CERTIFICATE_SERVICE_TEMPLATES
}
```

### Step 2: Universal Print Certificate Handler

```typescript
// /home/ktsang/opencrvs-countryconfig-atg/src/api/print-certificate/handler.ts

import { Request, ResponseToolkit } from '@hapi/hapi'
import fetch from 'node-fetch'
import { getTemplateName, hasTemplateSupport } from './templates'

const USE_TOPPAN_CERTIFICATE_SERVICE = process.env.USE_TOPPAN_CERTIFICATE_SERVICE === 'true'
const TOPPAN_CERTIFICATE_SERVICE_URL = process.env.TOPPAN_CERTIFICATE_SERVICE_URL || 'http://localhost:3889'

/**
 * Universal handler for PRINT_CERTIFICATE action
 *
 * Logic:
 * 1. Check feature flag
 * 2. Check if template exists in certificate-service
 * 3. Try certificate-service, fallback to client-side on any failure
 */
export async function printCertificateHandler(request: Request, h: ResponseToolkit) {
  const { event, action } = request.payload as any
  const templateId = action.certificate?.certificateTemplateId

  // Step 1: Feature flag disabled → client-side generation
  if (!USE_TOPPAN_CERTIFICATE_SERVICE) {
    console.log('[CERT] Feature flag disabled, using client-side generation')
    return h.response().code(200)
  }

  // Step 2: Template not configured → client-side generation
  if (!hasTemplateSupport(templateId)) {
    console.log(`[CERT] Template ${templateId} not supported by certificate-service, using client-side`)
    return h.response().code(200)
  }

  // Step 3: Template exists → try certificate-service
  const templateName = getTemplateName(event.type, templateId)
  console.log(`[CERT] Using certificate-service with template ${templateName}`)

  try {
    const certificateRequest = buildCertificateRequest(event, action, templateName!)

    const response = await fetch(
      `${TOPPAN_CERTIFICATE_SERVICE_URL}/api/certificates/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.authorization || ''
        },
        body: JSON.stringify(certificateRequest),
        timeout: 30000
      }
    )

    if (!response.ok) {
      console.error(`[CERT] Service returned ${response.status}, falling back to client-side`)
      return h.response().code(200)
    }

    const result = await response.json()
    console.log(`[CERT] Generated certificate: ${result.certificateNumber} (${result.pdf.sizeBytes} bytes)`)

    // Return PDF for client to print/download
    return h.response({
      success: true,
      certificateNumber: result.certificateNumber,
      pdfBase64: result.pdf.base64,
      generatedBy: 'toppan-certificate-service'
    }).code(200)

  } catch (error) {
    console.error('[CERT] Certificate service error, falling back to client-side:', error)
    return h.response().code(200)  // Fallback on any error
  }
}

function buildCertificateRequest(event: any, action: any, templateName: string) {
  // Extract names from FHIR format
  const getName = (nameArray: any[]) => {
    if (!nameArray || nameArray.length === 0) return { firstName: '', surname: '' }
    const name = nameArray[0]
    return {
      firstName: name.firstNames || name.given?.join(' ') || '',
      middleName: name.middleNames || '',
      surname: name.familyName || name.family || ''
    }
  }

  return {
    certificateType: event.type.replace('v2-', ''),
    templateName: templateName,

    child: event.child ? {
      ...getName(event.child.name),
      dateOfBirth: event.child.birthDate,
      sex: event.child.gender?.charAt(0).toUpperCase() + event.child.gender?.slice(1).toLowerCase(),
      placeOfBirth: event.child.birthLocation
    } : undefined,

    mother: event.mother ? {
      ...getName(event.mother.name),
      occupation: event.mother.occupation,
      nationality: event.mother.nationality
    } : undefined,

    father: event.father ? {
      ...getName(event.father.name),
      occupation: event.father.occupation,
      nationality: event.father.nationality
    } : undefined,

    deceased: event.deceased ? {
      ...getName(event.deceased.name),
      dateOfDeath: event.deceased.deathDate
    } : undefined,

    informant: event.informant ? {
      ...getName(event.informant.name),
      relationship: event.informant.relationship
    } : undefined,

    registrationNumber: event.registration?.registrationNumber,
    registrationDate: event.registration?.registeredDate || new Date().toISOString(),
    registrar: 'Chief Registrar',  // TODO: Get from user context
    parish: event.eventLocation?.name,

    recordUrl: `${process.env.CLIENT_APP_URL || 'http://localhost:3000'}/record-details/${event.id}`
  }
}
```

### Step 3: Register Route for ALL Event Types

```typescript
// /home/ktsang/opencrvs-countryconfig-atg/src/index.ts

import { printCertificateHandler } from '@countryconfig/api/print-certificate/handler'
import { ActionType } from '@opencrvs/commons/events'

// Register universal handler for all event types
const eventTypes = ['birth', 'death', 'marriage', 'v2-birth']

for (const eventType of eventTypes) {
  server.route({
    method: 'POST',
    path: `/events/${eventType}/actions/${ActionType.PRINT_CERTIFICATE}`,
    handler: printCertificateHandler,
    options: {
      tags: ['api', 'events'],
      description: 'Generate certificate (server-side or client-side based on template availability)'
    }
  })
}
```

### Step 4: Environment Configuration

```bash
# /home/ktsang/opencrvs-countryconfig-atg/.env
USE_TOPPAN_CERTIFICATE_SERVICE=true
TOPPAN_CERTIFICATE_SERVICE_URL=http://toppan-certificate:3889
CLIENT_APP_URL=http://localhost:3000
```

## Rollout Strategy

### Phase 1: Birth Certificates Only
```typescript
// templates.ts
export const CERTIFICATE_SERVICE_TEMPLATES = {
  'birth-certificate': 'antigua-birth-v1',
  'birth-certificate-certified-copy': 'antigua-birth-v1'
}
```
- Birth certificates → Certificate-service (QR + signature)
- Death/Marriage → Client-side (existing behavior)

### Phase 2: Add Death Certificates
```typescript
export const CERTIFICATE_SERVICE_TEMPLATES = {
  'birth-certificate': 'antigua-birth-v1',
  'birth-certificate-certified-copy': 'antigua-birth-v1',
  'death-certificate': 'antigua-death-v1',  // ADD
  'death-certificate-certified-copy': 'antigua-death-v1'  // ADD
}
```
- Birth + Death → Certificate-service
- Marriage → Client-side

### Phase 3: Add Marriage Certificates
```typescript
export const CERTIFICATE_SERVICE_TEMPLATES = {
  'birth-certificate': 'antigua-birth-v1',
  'birth-certificate-certified-copy': 'antigua-birth-v1',
  'death-certificate': 'antigua-death-v1',
  'death-certificate-certified-copy': 'antigua-death-v1',
  'marriage-certificate': 'antigua-marriage-v1',  // ADD
  'marriage-certificate-certified-copy': 'antigua-marriage-v1'  // ADD
}
```
- All certificates → Certificate-service

## Benefits

### ✅ Gradual Migration
- Add templates one at a time
- No "big bang" deployment
- Easy to test each certificate type

### ✅ Automatic Fallback
- Service unavailable → Client-side generation
- Template missing → Client-side generation
- Any error → Client-side generation
- **Zero downtime**

### ✅ Single Code Path
- One handler for all certificate types
- No duplicate logic
- Easy to maintain

### ✅ Feature Flag Control
```bash
# Instant enable/disable for all certificates
USE_TOPPAN_CERTIFICATE_SERVICE=false
```

## Example Logs

```
[CERT] Feature flag enabled, checking template support...
[CERT] Template 'birth-certificate' supported: true
[CERT] Using certificate-service with template antigua-birth-v1
[CERT] Generated certificate: BIRTH-2024-0001 (125000 bytes)
✅ Birth certificate generated via certificate-service

[CERT] Feature flag enabled, checking template support...
[CERT] Template 'death-certificate' supported: false
[CERT] Using client-side generation (template not configured)
✅ Death certificate generated via client-side (existing behavior)
```

## Testing Checklist

- [ ] Flag OFF: All certificates use client-side
- [ ] Flag ON + birth template: Birth uses certificate-service
- [ ] Flag ON + death template missing: Death uses client-side
- [ ] Certificate-service down: Falls back to client-side
- [ ] Certificate-service timeout: Falls back to client-side
- [ ] Invalid response: Falls back to client-side
- [ ] QR code scanning works
- [ ] PDF signature verification works

## Files to Create

1. `/home/ktsang/opencrvs-countryconfig-atg/src/api/print-certificate/templates.ts` - Template config
2. `/home/ktsang/opencrvs-countryconfig-atg/src/api/print-certificate/handler.ts` - Universal handler
3. `/home/ktsang/opencrvs-countryconfig-atg/src/api/print-certificate/index.ts` - Exports

## Files to Modify

1. `/home/ktsang/opencrvs-countryconfig-atg/src/environment.ts` - Add flags
2. `/home/ktsang/opencrvs-countryconfig-atg/src/index.ts` - Register routes
3. `/home/ktsang/opencrvs-countryconfig-atg/.env` - Config
4. `/home/ktsang/opencrvs-countryconfig-atg/toppan-override.yml` - Docker service

## Timeline

| Task | Duration |
|------|----------|
| Create template config | 30 min |
| Create universal handler | 2-3 hours |
| Register routes | 30 min |
| Environment setup | 30 min |
| Local testing | 2 hours |
| Deploy & verify | 1 hour |

**Total:** 1 day

Ready to implement the universal handler?
