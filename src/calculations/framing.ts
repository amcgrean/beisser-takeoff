import { WallSection, LineItem, JobInputs, Multipliers } from '../types/estimate';

export function calculateFraming(
    name: string,
    section: WallSection,
    inputs: JobInputs,
    multipliers: Multipliers
): LineItem[] {
    const items: LineItem[] = [];
    const { plateType, wallSize, triplePlate } = inputs.materials;
    const isBasement = name === 'Basement';

    const studMultiplier = isBasement
        ? multipliers.framing.stud_multiplier_basement.value
        : multipliers.framing.stud_multiplier_main.value;

    const totalLF = section.ext2x4_8ft + section.ext2x4_9ft + section.ext2x4_10ft +
        section.ext2x6_8ft + section.ext2x6_9ft + section.ext2x6_10ft +
        section.intWallLF;

    // Studs
    const studQty = Math.ceil(totalLF * studMultiplier * multipliers.framing.twenty_percent_waste.value);

    let studSku = 'STUD-STD'; // Default
    if (inputs.setup.branch === 'fort_dodge') {
        studSku = 'STUD-PREM-FD'; // Branch override example
    }

    items.push({
        qty: studQty,
        uom: 'EA',
        sku: studSku,
        description: `${wallSize} Studs - ${name}`,
        group: name,
        is_dynamic_sku: false
    });

    // Plates
    if (plateType === 'Treated') {
        const treatedQty = Math.ceil(totalLF / 14 / 3);
        items.push({
            qty: treatedQty,
            uom: 'EA',
            sku: 'TREATED-PLATE',
            description: `Treated Plate - ${name}`,
            group: name,
            is_dynamic_sku: false
        });
    } else {
        const tsQty = Math.ceil(totalLF / 16);
        items.push({
            qty: tsQty,
            uom: 'EA',
            sku: 'TS-PLATE',
            description: `Timberstrand Plate - ${name}`,
            group: name,
            is_dynamic_sku: false
        });
    }

    // Triple Plate
    if (triplePlate) {
        const tripleQty = Math.ceil(totalLF * multipliers.framing.triple_plate_factor.value / 16);
        items.push({
            qty: tripleQty,
            uom: 'EA',
            sku: 'PLATE-TRIPLE',
            description: `Triple Plate - ${name}`,
            group: name,
            is_dynamic_sku: false
        });
    }

    return items;
}
