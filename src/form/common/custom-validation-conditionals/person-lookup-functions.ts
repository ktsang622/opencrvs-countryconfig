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

// Query function for person lookup
export function personLookupQuery() {
  return `
    mutation PersonLookup($searchTerm: String!) {
      personLookup(searchTerm: $searchTerm) {
        firstNames
        familyName
        birthDate
        nationality
        nationalId
        maritalStatus
        educationalAttainment
        occupation
      }
    }
  `
}

// Response transformer for person lookup
export function personLookupTransformer(response: any) {
  if (response && response.data && response.data.personLookup) {
    const person = response.data.personLookup

    // Return object with field mappings to populate form
    return {
      motherFirstNames: person.firstNames,
      motherFamilyName: person.familyName,
      motherBirthDate: person.birthDate,
      motherNationality: person.nationality,
      motherNationalId: person.nationalId,
      motherMaritalStatus: person.maritalStatus,
      motherEducationalAttainment: person.educationalAttainment,
      motherOccupation: person.occupation
    }
  }

  throw new Error('Person not found')
}
