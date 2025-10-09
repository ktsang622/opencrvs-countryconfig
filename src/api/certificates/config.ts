/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * OpenCRVS is also distributed under the terms of the Civil Registration
 * & Healthcare Disclaimer located at http://opencrvs.org/license.
 *
 * Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
 */

import { Request, ResponseToolkit } from '@hapi/hapi'

/**
 * Certificate Configuration Handler
 *
 * Returns country-specific certificate configuration used by the gateway
 * to transform registration data into certificate requests.
 *
 * This is CONFIG ONLY - no business logic!
 */
export function certificateConfigHandler(request: Request, h: ResponseToolkit) {
  return h
    .response({
      // Template mappings
      templates: {
        birth: 'antigua-birth-v1',
        death: 'antigua-death-v1',
        marriage: 'antigua-marriage-v1'
      },

      // Address formatting rules
      addressFormat: {
        hierarchy: ['line', 'city', 'district', 'state', 'country'],
        separator: ', '
      },

      // Location hierarchy for event location
      locationHierarchy: ['parish', 'district', 'state'],

      // Amendment type mappings
      amendmentTypes: {
        child: 'BirthNameAndParticularsChanged',
        childDetails: 'BirthNameAndParticularsChanged',
        mother: 'MothersNameAndParticularsChanged',
        motherDetails: 'MothersNameAndParticularsChanged',
        father: 'FathersNameAndParticularsChanged',
        fatherDetails: 'FathersNameAndParticularsChanged',
        default: 'ChangeOfName'
      },

      // Late registration thresholds (days)
      lateRegistrationThreshold: {
        birth: 45,
        death: 7,
        marriage: 7
      },

      // Country code mappings (fallback if Intl.DisplayNames not available)
      countryCodes: {
        ATG: 'Antigua and Barbuda',
        USA: 'United States of America',
        GBR: 'United Kingdom',
        CAN: 'Canada'
      }
    })
    .code(200)
}
