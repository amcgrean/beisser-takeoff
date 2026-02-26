import { SidingSection, LineItem, JobInputs, Multipliers } from '../types/estimate';

export function calculateSiding(
    section: SidingSection,
    inputs: JobInputs,
    multipliers: Multipliers
): LineItem[] {
    const items: LineItem[] = [];

    // Lap Siding
    if (section.lapSF > 0) {
        let pieces = 0;
        if (section.lapType === 'LP') {
            const rate = multipliers.siding.lp[section.lapProfileSize]?.pieces_per_100sf || 9.0;
            pieces = Math.ceil((section.lapSF / 100) * rate);
        } else if (section.lapType === 'Hardie') {
            const rate = multipliers.siding.hardie[section.lapProfileSize]?.pieces_per_100sf || 6.0;
            pieces = Math.ceil((section.lapSF / 100) * rate);
        } else if (section.lapType === 'Vinyl') {
            pieces = Math.ceil((section.lapSF / 100) * multipliers.siding.vinyl.default.pieces_per_100sf);
        }

        items.push({
            qty: pieces,
            uom: 'EA',
            sku: `LAP-${section.lapType}-${section.lapProfileSize}`,
            description: `${section.lapType} ${section.lapProfileSize} Lap Siding`,
            group: 'Siding',
            is_dynamic_sku: false
        });
    }

    // Soffit
    if (section.soffitSF > 0) {
        const pieces = Math.ceil(section.soffitSF / 32); // Generic 4x8 panels for now
        items.push({
            qty: pieces,
            uom: 'EA',
            sku: `SOFFIT-${section.soffitType}`,
            description: `${section.soffitType} Soffit Panels`,
            group: 'Siding',
            is_dynamic_sku: false
        });
    }

    return items;
}
