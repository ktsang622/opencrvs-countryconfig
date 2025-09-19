import fs from 'node:fs'
import path from 'node:path'
import { stringify } from 'csv-stringify/sync'
import type { WorkBook } from 'xlsx'
import * as XLSX from 'xlsx'

const CORE_ROOT = path.resolve(__dirname, '..', '..', 'opencrvs-core')
const MIGRATION_DIR = path.resolve(CORE_ROOT, 'data-migration')
const BIRTHS_FILE = path.resolve(MIGRATION_DIR, 'AB_MERGE (0221)_BI.xlsx')

if (!fs.existsSync(BIRTHS_FILE)) {
  throw new Error(`Expected migration workbook at ${BIRTHS_FILE}`)
}

const workbook: WorkBook = XLSX.readFile(BIRTHS_FILE, { cellDates: false })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
  defval: ''
})

const ADMIN0_NAME = 'Antigua and Barbuda'
const ADMIN0_CODE = 'ATG'

type ParishStats = {
  island: string
  counts: Map<number, number>
}

const parishMap = new Map<string, ParishStats>()

function canonicalParish(value: unknown): string {
  let name = String(value ?? '').trim().toUpperCase()
  if (!name || name === 'NULL' || name === '1') {
    return ''
  }
  name = name.replace(/'S/g, '')
  name = name.replace(/\./g, '')
  name = name.replace(/[^A-Z ]/g, ' ')
  name = name.replace(/\s+/g, ' ').trim()
  name = name.replace(/\bst\b/gi, 'SAINT')
  if (name.startsWith('ST')) {
    name = 'SAINT ' + name.slice(2).trim()
  }
  if (name.startsWith('SAINT') && name.length > 5 && name[5] !== ' ') {
    name = 'SAINT ' + name.slice(5)
  }
  if (name.includes('JOHN')) name = 'SAINT JOHN'
  if (name.includes('GEORGE')) name = 'SAINT GEORGE'
  if (name.includes('MARY')) name = 'SAINT MARY'
  if (name.includes('PAUL')) name = 'SAINT PAUL'
  if (name.includes('PETER')) name = 'SAINT PETER'
  if (name.includes('PHILIP') || name.includes('PHILLIP')) name = 'SAINT PHILIP'
  if (name.includes('HOLY TRINITY')) name = 'HOLY TRINITY'
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function slugify(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function getIslandForParish(parish: string) {
  return parish === 'Holy Trinity' ? 'Barbuda' : 'Antigua'
}

for (const row of rows) {
  const parish = canonicalParish(row['parish_nm'])
  if (!parish) continue
  const yearValue = row['entry_yr'] ?? row['entry_year']
  const year = Number(yearValue)
  if (!Number.isFinite(year) || year < 1970 || year > 2030) continue

  let stats = parishMap.get(parish)
  if (!stats) {
    stats = { island: getIslandForParish(parish), counts: new Map() }
    parishMap.set(parish, stats)
  }
  stats.counts.set(year, (stats.counts.get(year) ?? 0) + 1)
}

const parishes = Array.from(parishMap.entries()).sort((a, b) =>
  a[0].localeCompare(b[0])
)

type StateAggregate = {
  name: string
  male: Map<number, number>
  female: Map<number, number>
  population: Map<number, number>
  count: Map<number, number>
}

const stateAggregates = new Map<string, StateAggregate>()

const locationsCsvPath = path.resolve(
  __dirname,
  '..',
  'src/data-seeding/locations/source/locations.csv'
)
const crvsCsvPath = path.resolve(
  __dirname,
  '..',
  'src/data-seeding/locations/source/crvs-facilities.csv'
)
const healthCsvPath = path.resolve(
  __dirname,
  '..',
  'src/data-seeding/locations/source/health-facilities.csv'
)
const statisticsCsvPath = path.resolve(
  __dirname,
  '..',
  'src/data-seeding/locations/source/statistics.csv'
)
const employeesCsvPath = path.resolve(
  __dirname,
  '..',
  'src/data-seeding/employees/source/default-employees.csv'
)
const prodEmployeesCsvPath = path.resolve(
  __dirname,
  '..',
  'src/data-seeding/employees/source/prod-employees.csv'
)

const locationRows = [
  [
    'admin2Name_en',
    'admin2Name_alias',
    'admin2Pcode',
    'admin1Name_en',
    'admin1Name_alias',
    'admin1Pcode',
    'admin0Name_en',
    'admin0Name_alias',
    'admin0Pcode'
  ]
]

const crvsRows = [['id', 'name', 'partOf', 'locationType']]
const healthRows = [['id', 'name', 'partOf', 'locationType']]

const yearSet = new Set<number>()
parishes.forEach(([, stats]) => {
  stats.counts.forEach((_count, year) => yearSet.add(year))
})
const years = Array.from(yearSet).sort((a, b) => a - b)

const statsHeader = ['adminPcode', 'name']
for (const year of years) {
  statsHeader.push(
    `male_population_${year}`,
    `female_population_${year}`,
    `population_${year}`,
    `crude_birth_rate_${year}`
  )
}
const statisticsRows: (string | number)[][] = [statsHeader]

const employeeRows: (string | number)[][] = [
  ['primaryOfficeId', 'givenNames', 'familyName', 'role', 'mobile', 'username', 'email', 'password']
]

const baseRoleTemplates = [
  { given: 'Anika', family: 'Thomas', role: 'LOCAL_SYSTEM_ADMIN' },
  { given: 'Darius', family: 'Henry', role: 'LOCAL_REGISTRAR' },
  { given: 'Maya', family: 'Joseph', role: 'REGISTRATION_AGENT' },
  { given: 'Eldon', family: 'Richards', role: 'SOCIAL_WORKER' },
  { given: 'Grace', family: 'Samuel', role: 'LOCAL_LEADER' }
]

const nationalRoleTemplates = [
  { given: 'Jonathan', family: 'Campbell', role: 'NATIONAL_SYSTEM_ADMIN' },
  { given: 'Edgar', family: 'Kazembe', role: 'PERFORMANCE_MANAGER' },
  { given: 'Joseph', family: 'Musonda', role: 'NATIONAL_REGISTRAR' }
]

let employeeSequence = 0

function toKebab(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function addEmployee(
  officeId: string,
  parish: string,
  template: { given: string; family: string; role: string }
) {
  employeeSequence += 1
  const parishSlug = slugify(parish).toLowerCase()
  const roleSlug = toKebab(template.role)
  const username = `${template.given[0].toLowerCase()}.${template.family.toLowerCase()}.${roleSlug}.${parishSlug}`
  const mobile = `+1268${(5000000 + employeeSequence).toString().padStart(7, '0')}`
  employeeRows.push([
    officeId,
    template.given,
    template.family,
    template.role,
    mobile,
    username,
    `${username}@opencrvs-atg.test`,
    'Password123!'
  ])
}

for (const [parish, stats] of parishes) {
  const island = stats.island
  const admin1Code = `${ADMIN0_CODE}-${slugify(island)}`
  const admin2Code = `${admin1Code}-${slugify(parish)}`

  const aggregate = (() => {
    const existing = stateAggregates.get(admin1Code)
    if (existing) {
      return existing
    }
    const created: StateAggregate = {
      name: island,
      male: new Map(),
      female: new Map(),
      population: new Map(),
      count: new Map()
    }
    stateAggregates.set(admin1Code, created)
    return created
  })()

  locationRows.push([
    parish,
    parish,
    admin2Code,
    island,
    island,
    admin1Code,
    ADMIN0_NAME,
    ADMIN0_NAME,
    ADMIN0_CODE
  ])

  const crvsId = `CRVS_OFFICE_${slugify(parish)}`
  const healthId = `HEALTH_FACILITY_${slugify(parish)}`

  crvsRows.push([
    crvsId,
    `${parish} Civil Registry`,
    `Location/${admin2Code}`,
    'CRVS_OFFICE'
  ])

  healthRows.push([
    healthId,
    `${parish} Health Centre`,
    `Location/${admin2Code}`,
    'HEALTH_FACILITY'
  ])

  const yearCounts = stats.counts
  const statRow: (string | number)[] = [admin2Code, parish]
  for (const year of years) {
    const count = yearCounts.get(year) ?? 0
    const basePopulation = 5000 + count * 50
    const malePop = Math.round(basePopulation * 0.49)
    const femalePop = basePopulation - malePop
    const crudeRate = count === 0 ? 0 : Number(((count / basePopulation) * 1000).toFixed(2))
    statRow.push(malePop, femalePop, basePopulation, crudeRate)

    aggregate.male.set(year, (aggregate.male.get(year) ?? 0) + malePop)
    aggregate.female.set(year, (aggregate.female.get(year) ?? 0) + femalePop)
    aggregate.population.set(year, (aggregate.population.get(year) ?? 0) + basePopulation)
    aggregate.count.set(year, (aggregate.count.get(year) ?? 0) + count)
  }
  statisticsRows.push(statRow)

  for (const template of baseRoleTemplates) {
    addEmployee(crvsId, parish, template)
  }

  if (parish === 'Saint John') {
    for (const template of nationalRoleTemplates) {
      addEmployee(crvsId, parish, template)
    }
  }
}

for (const [admin1Code, aggregate] of stateAggregates.entries()) {
  const statRow: (string | number)[] = [admin1Code, aggregate.name]
  for (const year of years) {
    const totalPopulation = aggregate.population.get(year) ?? 0
    const totalMale = aggregate.male.get(year) ?? 0
    const totalFemale = aggregate.female.get(year) ?? 0
    const totalCount = aggregate.count.get(year) ?? 0
    const crudeRate = totalPopulation === 0 ? 0 : Number(((totalCount / totalPopulation) * 1000).toFixed(2))
    statRow.push(totalMale, totalFemale, totalPopulation, crudeRate)
  }
  statisticsRows.push(statRow)
}

function writeCsv(filePath: string, data: (string | number)[][]) {
  const csv = stringify(data, { quoted: false })
  fs.writeFileSync(filePath, csv)
}

writeCsv(locationsCsvPath, locationRows)
writeCsv(crvsCsvPath, crvsRows)
writeCsv(healthCsvPath, healthRows)
writeCsv(statisticsCsvPath, statisticsRows)
writeCsv(employeesCsvPath, employeeRows)
writeCsv(prodEmployeesCsvPath, employeeRows)

console.log('Generated ATG data-seeding files:')
console.log(` - ${path.relative(path.resolve(__dirname, '..'), locationsCsvPath)}`)
console.log(` - ${path.relative(path.resolve(__dirname, '..'), crvsCsvPath)}`)
console.log(` - ${path.relative(path.resolve(__dirname, '..'), healthCsvPath)}`)
console.log(` - ${path.relative(path.resolve(__dirname, '..'), statisticsCsvPath)}`)
console.log(` - ${path.relative(path.resolve(__dirname, '..'), employeesCsvPath)}`)
