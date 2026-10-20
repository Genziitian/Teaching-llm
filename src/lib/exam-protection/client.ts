export type ProtectionPurchase = {
    id: string;
    courseKey: string;
    courseName: string;
    subject: string;
    fee: number;
    paidAt: string;
    claimWindow?: 'not_open' | 'open' | 'closed';
    claimsCloseAt?: string | null;
    user?: {
        name: string;
        email: string;
    };
    claim?: {
        id: string;
    } | null;
};
export type ProtectionClaim = {
    id: string;
    status: string;
    benefit: 'refund' | 'coupon';
    reason: string;
    attempted: boolean;
    marks: number | null;
    message: string;
    createdAt: string;
    deliveredAt: string | null;
    couponRevealedAt: string | null;
    refundAmount: number | null;
    refundReference: string | null;
    purchase: ProtectionPurchase;
    proof: {
        expiresAt: string;
    } | null;
    coupon: {
        code: string | null;
        expiresAt: string | null;
        currentUses: number;
        maxUses: number | null;
        isActive: boolean;
    } | null;
    events: {
        id: string;
        message: string;
        internal: boolean;
        createdAt: string;
    }[];
};
export type ProtectionCoupon = Pick<ProtectionClaim, 'id' | 'couponRevealedAt' | 'coupon'> & {
    purchase: {
        courseName: string;
        fee: number;
    };
};
export type ProtectionData = {
    coupons: ProtectionCoupon[];
    manager: boolean;
    email: string;
    isOpen: boolean;
    rules: string;
    retentionDays: number;
    reasons: string[];
    courses: {
        id: string;
        name: string;
        subject: string | null;
        fee: number;
        claimWindow: 'not_open' | 'open' | 'closed';
        claimsCloseAt: string | null;
        protected: boolean;
    }[];
    purchases: ProtectionPurchase[];
    claims: ProtectionClaim[];
};
export async function protectionRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
    const multipart = body instanceof FormData;
    const response = await fetch('/api/exam-protection' + path, { method, cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest', ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok)
        throw new Error(data.error || 'Could not load exam protection.');
    return data as T;
}
