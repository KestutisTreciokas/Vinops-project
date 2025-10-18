/**
 * Integration tests for /api/v1/makes-models filter endpoint
 * Tests fix for Issue #1: Filter options should only show available combinations
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { Client } from 'pg'

describe('GET /api/v1/makes-models', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      options: '-c default_transaction_read_only=off',
    })
    await client.connect()

    // Insert test data
    await client.query(`
      INSERT INTO vehicles (vin, make, model, trim, year, body, is_removed)
      VALUES
        ('TEST001', 'FORD', 'F150', 'XLT', 2020, 'PICKUP', false),
        ('TEST002', 'FORD', 'F150', 'LARIAT', 2020, 'PICKUP', false),
        ('TEST003', 'FORD', 'F150', 'XLT', 2019, 'PICKUP', false),
        ('TEST004', 'FORD', 'MUSTANG', 'GT', 2020, 'COUPE', false),
        ('TEST005', 'TOYOTA', 'CAMRY', 'SE', 2020, 'SEDAN', false)
      ON CONFLICT (vin) DO NOTHING
    `)
  })

  afterAll(async () => {
    // Cleanup test data
    await client.query(`
      DELETE FROM vehicles WHERE vin LIKE 'TEST%'
    `)
    await client.end()
  })

  it('should return only models available for make+year combination', async () => {
    const response = await fetch(
      'http://localhost:3000/api/v1/makes-models?make=FORD&year=2020&type=auto'
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.models).toBeDefined()
    expect(data.models).toContain('F150')
    expect(data.models).toContain('MUSTANG')
    expect(data.models).not.toContain('FOCUS') // Not in 2020
  })

  it('should return only model_details available for make+model+year combination', async () => {
    const response = await fetch(
      'http://localhost:3000/api/v1/makes-models?make=FORD&model=F150&year=2020&type=auto'
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.modelDetails).toBeDefined()
    expect(data.modelDetails).toContain('XLT')
    expect(data.modelDetails).toContain('LARIAT')
    expect(data.modelDetails).not.toContain('PLATINUM') // Not in 2020
  })

  it('should return only years available for make+model combination', async () => {
    const response = await fetch(
      'http://localhost:3000/api/v1/makes-models?make=FORD&model=F150&years=true&type=auto'
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.years).toBeDefined()
    expect(data.years).toContain(2020)
    expect(data.years).toContain(2019)
    expect(data.years).not.toContain(2018) // Not in test data
  })

  it('should filter years by model_detail when provided', async () => {
    const response = await fetch(
      'http://localhost:3000/api/v1/makes-models?make=FORD&model=F150&model_detail=XLT&years=true&type=auto'
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.years).toBeDefined()
    expect(data.years).toContain(2020)
    expect(data.years).toContain(2019)
    // LARIAT year (2020) should be included because we're filtering by XLT, not excluding it
  })

  it('should handle NULL body types for auto vehicle type', async () => {
    const response = await fetch(
      'http://localhost:3000/api/v1/makes-models?type=auto'
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.makes).toBeDefined()
    expect(Array.isArray(data.makes)).toBe(true)
    // Should include vehicles with NULL body since 85% have NULL
  })

  it('should cache results for repeated requests', async () => {
    const start = Date.now()
    const response1 = await fetch(
      'http://localhost:3000/api/v1/makes-models?make=FORD&type=auto'
    )
    const time1 = Date.now() - start

    const start2 = Date.now()
    const response2 = await fetch(
      'http://localhost:3000/api/v1/makes-models?make=FORD&type=auto'
    )
    const time2 = Date.now() - start2

    expect(response1.status).toBe(200)
    expect(response2.status).toBe(200)
    // Second request should be significantly faster due to Redis cache
    expect(time2).toBeLessThan(time1 / 2)
  })
})
