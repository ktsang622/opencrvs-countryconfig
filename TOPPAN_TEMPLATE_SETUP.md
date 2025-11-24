# Toppan Certificate Templates Setup

## Architecture

**Same pattern as OpenCRVS SVG templates** - templates served via HTTP endpoint, no file mounts.

### OpenCRVS Pattern (Client-Side):
```
Client → GET /api/countryconfig/certificates/birth-certificate.svg
       ← Returns SVG file from src/api/certificates/source/
```

### Toppan Pattern (Server-Side):
```
Certificate-Service → GET /api/countryconfig/certificates/toppan/birth/ElmLayout.txt
                    ← Returns ElmLayout file from src/api/certificates/toppan-templates/birth/
```

## Template Storage

```
/home/ktsang/opencrvs-countryconfig-atg/
└── src/api/certificates/
    ├── source/                              # OpenCRVS SVG templates (client-side)
    │   ├── birth-certificate.svg
    │   ├── death-certificate.svg
    │   └── marriage-certificate.svg
    │
    └── toppan-templates/                    # Toppan ElmLayout templates (server-side)
        ├── birth/
        │   ├── ElmLayout.txt                ✅ Copied
        │   ├── BirthCertificateBackground.jpg ✅ Copied
        │   └── signature.png                ✅ Copied
        │
        ├── death/                           📋 Future
        │   ├── ElmLayout.txt
        │   └── DeathCertificateBackground.jpg
        │
        └── marriage/                        📋 Future
            ├── ElmLayout.txt
            └── MarriageCertificateBackground.jpg
```

## HTTP Endpoints

### Template Serving (Already Implemented ✅)

**Handler:** `src/api/certificates/toppan-handler.ts`

**Route:** `GET /api/countryconfig/certificates/toppan/{templateType}/{filename}`

**Examples:**
```bash
# Get ElmLayout template
curl http://localhost:3040/api/countryconfig/certificates/toppan/birth/ElmLayout.txt

# Get background image
curl http://localhost:3040/api/countryconfig/certificates/toppan/birth/BirthCertificateBackground.jpg

# Get signature
curl http://localhost:3040/api/countryconfig/certificates/toppan/birth/signature.png
```

**Authentication:** None required (auth: false)

## Certificate-Service Configuration

Certificate-service will fetch templates from country-config via HTTP:

```json
{
  "CertificateService": {
    "TemplatesPath": "http://countryconfig:3040/api/countryconfig/certificates/toppan",
    "Templates": {
      "Birth": {
        "FolderName": "birth",
        "LayoutFile": "ElmLayout.txt",
        "BackgroundImage": "BirthCertificateBackground.jpg",
        "SignatureImage": "signature.png"
      }
    }
  }
}
```

## Flow

### 1. Print Certificate Action
```
User clicks "Certify"
  ↓
Events Service → POST /events/birth/actions/PRINT_CERTIFICATE
  ↓
Country-Config handler:
  - Check feature flag
  - Check template support
  - Call certificate-service
  ↓
Certificate-Service:
  - Fetch templates from country-config via HTTP
  - Generate PDF with QR + signature
  - Return PDF base64
  ↓
Client:
  - Print/download PDF
```

### 2. Template Loading (Certificate-Service)
```
Certificate-Service needs Birth template
  ↓
GET http://countryconfig:3040/api/countryconfig/certificates/toppan/birth/ElmLayout.txt
GET http://countryconfig:3040/api/countryconfig/certificates/toppan/birth/BirthCertificateBackground.jpg
  ↓
Certificate-Service:
  - Cache templates in memory
  - Render certificate
```

## Benefits

### ✅ No File Mounts
- Templates served via HTTP (same as SVG)
- No Docker volume complexity
- No file permission issues

### ✅ Country-Specific
- Templates live in country-config repo
- Easy to customize per country
- Version controlled with country config

### ✅ Dynamic Updates
- Certificate-service can cache + reload
- No restart needed for template changes
- Country can update templates independently

### ✅ Consistent Pattern
- Same pattern as OpenCRVS SVG templates
- Familiar to OpenCRVS developers
- Easy to understand and maintain

## Files Created

1. ✅ `src/api/certificates/toppan-handler.ts` - HTTP endpoint handler
2. ✅ `src/api/certificates/toppan-templates/birth/ElmLayout.txt` - Birth template
3. ✅ `src/api/certificates/toppan-templates/birth/BirthCertificateBackground.jpg` - Background
4. ✅ `src/api/certificates/toppan-templates/birth/signature.png` - Signature

## Files Modified

1. ✅ `src/index.ts` - Added toppan template route

## Next Steps

1. Test template endpoint locally
2. Update certificate-service to fetch from HTTP instead of file system
3. Add death/marriage templates as needed
4. Implement print certificate handler with feature flag

## Testing

```bash
# Start country-config
cd /home/ktsang/opencrvs-countryconfig-atg
yarn start

# Test template endpoint
curl http://localhost:3040/api/countryconfig/certificates/toppan/birth/ElmLayout.txt
# Should return template content

curl http://localhost:3040/api/countryconfig/certificates/toppan/birth/BirthCertificateBackground.jpg > test.jpg
# Should download image

# Test certificate-service can fetch templates
# Update certificate-service config to use HTTP URLs
# Generate test certificate
```

## Future Enhancements

### Short-term:
- Add death certificate templates
- Add marriage certificate templates
- Template caching in certificate-service
- Template versioning

### Long-term:
- SVG → ElmLayout converter
- Unified template format
- Visual template editor
- Template validation endpoint
