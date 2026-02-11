/**
 * Line calculation logic — must match backend exactly (create-sale-line.ts)
 */

export function calculateLineAmounts(data: {
  quantity: number
  unitPrice: number
  discount?: number
  taxRate: number
}) {
  const discount = data.discount || 0

  const discountAmount = (data.quantity * data.unitPrice * discount) / 100
  const netAmount = data.quantity * data.unitPrice - discountAmount
  const taxAmount = (netAmount * data.taxRate) / 100
  const totalAmount = netAmount + taxAmount

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  }
}

export function calculateSaleTotals(lines: Array<{ netAmount: number; taxAmount: number; totalAmount: number }>) {
  const subtotal = lines.reduce((sum, l) => sum + l.netAmount, 0)
  const taxAmount = lines.reduce((sum, l) => sum + l.taxAmount, 0)
  const total = lines.reduce((sum, l) => sum + l.totalAmount, 0)

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  }
}
