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

import * as Hapi from '@hapi/hapi'
import * as Joi from 'joi'

export const personLookupSchema = Joi.object({
  searchTerm: Joi.string().required()
})

export async function personLookupHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const { searchTerm } = request.payload as { searchTerm: string }

  try {
    // Replace this with your actual external system integration
    const personData = await lookupPersonFromExternalSystem(searchTerm)

    if (!personData) {
      return h.response({ error: 'Person not found' }).code(404)
    }

    return h.response(personData).code(200)
  } catch (error) {
    console.error('Person lookup error:', error)
    return h.response({ error: 'Lookup failed' }).code(500)
  }
}

// Replace this function with your actual external system integration
async function lookupPersonFromExternalSystem(searchTerm: string) {
  // CONFIGURE YOUR EXTERNAL API HERE:
  // const response = await fetch(`https://your-external-api.com/person/${searchTerm}`, {
  //   method: 'GET',
  //   headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
  // })
  // const data = await response.json()
  // return data

  // Mock data - remove this when connecting to real API
  if (searchTerm === '123456789') {
    return {
      motherFirstNames: 'Jane',
      motherFamilyName: 'Doe',
      motherBirthDate: '1990-05-15',
      motherNationality: 'FAR',
      motherNationalId: '123456789',
      motherMaritalStatus: 'MARRIED',
      motherEducationalAttainment: 'SECONDARY_ISCED_2',
      motherOccupation: 'Teacher'
    }
  }

  return null
}
