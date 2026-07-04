// 保固／墜車折扣判斷 — 純函式，不碰資料庫
//
// 對應真實品牌條款（例如 ENVE）的結構：瑕疵保固（defect）與墜車折扣重購（crash）
// 是兩套分開的制度，不是單一「保固中/過保」的二分法：
// - defect：製造瑕疵，免費換料件（不含工資），終身或固定年限，通常要求原始買家
// - crash：意外/墜車造成的損壞，不是免費保固，而是「前 N 年免費、之後打折重購」的方案
// - 正常磨損件（外胎、來令片等）不論哪一種都不理賠

export type ClaimType = 'defect' | 'crash'

export interface WarrantyPolicy {
  isWearItem: boolean
  defectLifetime: boolean
  defectYears: number | null
  defectRequiresOriginalOwner: boolean
  defectSubsequentOwnerYears: number | null
  crashDiscountPct: number | null   // null = 此品類無墜車折扣方案
  crashFreeYears: number
  crashRequiresOriginalOwner: boolean
  laborIncluded: boolean
  claimChannel: string | null
}

export interface CoverageResult {
  eligible: boolean
  payPercentOfMsrp: number   // 0=原廠全額理賠；100=無理賠，需全額購買；其餘為折扣後應付比例
  reason: string
  requiresOemClaim: boolean  // 是否需要另外送原廠審核（claim_channel 有設定時）
}

export function evaluateCoverage(
  policy: WarrantyPolicy,
  claimType: ClaimType,
  yearsSincePurchase: number | null,   // null = 查無購買紀錄，無法驗證原始買家身分
  laborNote = true
): CoverageResult {
  const isOriginalOwner = yearsSincePurchase !== null

  if (policy.isWearItem) {
    return {
      eligible: false,
      payPercentOfMsrp: 100,
      reason: '此品類屬於正常磨損件，不在保固或墜車折扣範圍內。',
      requiresOemClaim: false,
    }
  }

  if (claimType === 'defect') {
    if (isOriginalOwner) {
      if (policy.defectRequiresOriginalOwner) {
        const covered = policy.defectLifetime || (policy.defectYears !== null && yearsSincePurchase! <= policy.defectYears)
        if (covered) {
          return {
            eligible: true,
            payPercentOfMsrp: 0,
            reason: `製造瑕疵保固範圍內（${policy.defectLifetime ? '終身保固' : `${policy.defectYears} 年內`}），免費更換料件${policy.laborIncluded ? '含工資' : laborNote ? '，工資需自付' : ''}。`,
            requiresOemClaim: !!policy.claimChannel,
          }
        }
      }
    } else if (policy.defectSubsequentOwnerYears !== null) {
      // 非原始買家（查無此帳號購買紀錄）：多數品牌仍提供較短年限的瑕疵保固，但年限從「查無購買紀錄」無法起算，
      // 只能提示需要買家自行提供其他證明，不能由系統自動判定天數
      return {
        eligible: false,
        payPercentOfMsrp: 100,
        reason: `查無此帳號購買紀錄，無法確認是否為原始買家。若買家能提供其他購買證明，非原始買家仍可能有 ${policy.defectSubsequentOwnerYears} 年瑕疵保固（從製造日起算），需人工確認。`,
        requiresOemClaim: !!policy.claimChannel,
      }
    }
    return {
      eligible: false,
      payPercentOfMsrp: 100,
      reason: isOriginalOwner ? '已超過瑕疵保固年限，需全額購買。' : '查無購買紀錄，無法判定保固資格。',
      requiresOemClaim: false,
    }
  }

  // claimType === 'crash'
  if (policy.crashDiscountPct === null) {
    return {
      eligible: false,
      payPercentOfMsrp: 100,
      reason: '此品類無墜車折扣重購方案，需全額購買。',
      requiresOemClaim: false,
    }
  }
  if (policy.crashRequiresOriginalOwner && !isOriginalOwner) {
    return {
      eligible: false,
      payPercentOfMsrp: 100,
      reason: '墜車折扣重購方案僅限原始買家，查無此帳號購買紀錄，需全額購買。',
      requiresOemClaim: false,
    }
  }
  const free = yearsSincePurchase !== null && yearsSincePurchase <= policy.crashFreeYears
  const payPercentOfMsrp = free ? 0 : 100 - policy.crashDiscountPct
  return {
    eligible: true,
    payPercentOfMsrp,
    reason: free
      ? `墜車折扣重購方案範圍內（購入 ${policy.crashFreeYears} 年內），免費更換料件${policy.laborIncluded ? '含工資' : '，工資需自付'}。`
      : `超過免費期，可依墜車折扣重購方案以 ${payPercentOfMsrp}%（打 ${(payPercentOfMsrp / 10).toFixed(1)} 折）購入替代品，工資需自付。`,
    requiresOemClaim: !!policy.claimChannel,
  }
}

export function yearsSince(purchaseDate: Date, today: Date = new Date()): number {
  return (today.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
}
