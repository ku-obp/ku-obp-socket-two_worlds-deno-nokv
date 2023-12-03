export type PaymentType = {kind: "P2P" | "P2M" | "P2G" | "G2P" | "P2C" | "M2P" | "C2P" | "P2O" , cost: {
    default: number,
    additional: number
}} | {
    kind: "G2M",
    cost: {
        fixed: number
    }
} | {
    kind: "P2D",
    cost: {
        perPlayer: number
    }
};

export function generateNormalPaymentInfo(kind: "P2P" | "P2M" | "P2G" | "G2P" | "P2C" | "M2P" | "C2P" | "P2O", default_cost: number, additional_cost = 0): PaymentType {
    return {
        kind,
        cost: {
            default: default_cost,
            additional: additional_cost
        }
    }
}

export function generateP2DPaymentInfo(perPlayer: number): PaymentType {
    return {
        kind: "P2D",
        cost: {
            perPlayer
        }
    }
}

export function generateG2MPaymentInfo(fixed: number): PaymentType {
    return {
        kind: "G2M",
        cost: {
            fixed
        }
    }
}

export const PLAYER_COLORS=[
    "red",
    "green",
    "blue",
    "yellow"
]

export class DifferentNumberPair<T extends number> {
    public readonly a: T
    public readonly b: T
    private constructor(readonly _a: T, readonly _b: T) {
        this.a = _a
        this.b = _b
    }
    public static checkDifferent<T extends number>(a: T, b: T) {
        if (a === b) {
            return new DifferentNumberPair<T>(a,b)
        }
        else return null
    }
}

export function nullableMapper<T, R, N>(orig: T | null, mapNonNull: (value: T) => R, {mapNullIsGenerator, generator, constant}: {mapNullIsGenerator: true, generator: () => N, constant?: undefined} | {mapNullIsGenerator: false, generator?: undefined, constant: N}): R | N {
    if (orig !== null) {
        return mapNonNull(orig);
    } else if(mapNullIsGenerator) {
        return generator()
    } else {
        return constant
    }
}