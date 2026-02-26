import { HardwareSection, LineItem, JobInputs, HardwareMatrix, HardwareLookup } from '../types/estimate';

export function calculateHardware(
    section: HardwareSection,
    inputs: JobInputs,
    matrix: HardwareMatrix,
    lookups: HardwareLookup[]
): LineItem[] {
    const items: LineItem[] = [];

    const lookup = lookups.find(l => l.display_name === section.type);
    if (!lookup) return items;

    const finish = lookup.finish_code;
    const finishMatrix = matrix[finish];

    if (!finishMatrix) return items;

    const functionKeys = Object.keys(section.counts) as (keyof typeof section.counts)[];

    for (const func of functionKeys) {
        const qty = section.counts[func];
        if (qty <= 0) continue;

        const sku = finishMatrix[func];

        // Handle null inside_trim (known_issues.json id: 4)
        if (sku === null) continue;

        const warning = (section.type === 'PlymouthBN' && func === 'passage')
            ? '⚠ The passage SKU may be wrong'
            : undefined;

        items.push({
            qty,
            uom: 'EA',
            sku: sku || 'MANUAL-ENTRY',
            description: `${section.type} ${func}`,
            group: 'Hardware',
            is_dynamic_sku: false,
            warning
        });
    }

    return items;
}
