import { WallSection, LineItem, JobInputs, Multipliers } from '../types/estimate';

export function getLVLCode(size: string, length_ft: number, engineeredLumber: any): string {
    const entry = engineeredLumber?.size_to_prefix?.find((e: any) => e.size === size);
    if (!entry) return `HDR-${size.replace(/[^a-z0-9]/gi, '')}-${String(length_ft).padStart(2, '0')}`;
    return entry.prefix + String(length_ft).padStart(2, '0');
}

export function calculateFraming(
    name: string,
    section: WallSection,
    inputs: JobInputs,
    multipliers: Multipliers,
    engineeredLumber?: any,
    branches?: any[],
    customerOverrides?: any
): LineItem[] {
    const items: LineItem[] = [];
    const { plateType, wallSize, triplePlate } = inputs.materials;
    const isBasement = name === 'Basement';

    const studMultiplier = isBasement
        ? multipliers.framing.stud_multiplier_basement.value
        : multipliers.framing.stud_multiplier_main.value;

    const totalLF =
        section.ext2x4_8ft + section.ext2x4_9ft + section.ext2x4_10ft +
        section.ext2x6_8ft + section.ext2x6_9ft + section.ext2x6_10ft +
        section.intWallLF;

    if (totalLF <= 0) return items;

    // ── Branch stud SKU override (branches.json field is "stud_sku") ───────────
    const branchData = branches?.find((b: any) => b.branch_id === inputs.setup.branch);
    let studSku = branchData?.stud_sku ?? (wallSize === '2x4' ? '0204studfir08' : '0206studfir09');

    // ── Studs ────────────────────────────────────────────────────────────────────
    const studQty = Math.ceil(totalLF * studMultiplier * multipliers.framing.twenty_percent_waste.value);
    if (studQty > 0) {
        items.push({
            qty: studQty,
            uom: 'EA',
            sku: studSku,
            description: `${wallSize} Studs — ${name}`,
            group: name === 'Basement' ? 'Basement' : name.includes('1st') ? '1st Walls' : '2nd Walls',
            is_dynamic_sku: false,
        });
    }

    // ── Plates ───────────────────────────────────────────────────────────────────
    const group = name === 'Basement' ? 'Basement' : name.includes('1st') ? '1st Walls' : '2nd Walls';

    if (plateType === 'Treated') {
        const qty = Math.ceil(totalLF / 14 / 3);
        if (qty > 0) items.push({ qty, uom: 'EA', sku: 'treatplate14', description: `Treated Plate — ${name}`, group, is_dynamic_sku: false });
    } else {
        const qty = Math.ceil(totalLF / 16);
        if (qty > 0) items.push({ qty, uom: 'EA', sku: 'tmbrstnd116', description: `Timberstrand Plate 16ft — ${name}`, group, is_dynamic_sku: false });
    }

    // ── Triple plate ─────────────────────────────────────────────────────────────
    if (triplePlate) {
        const qty = Math.ceil(totalLF * multipliers.framing.triple_plate_factor.value / 16);
        if (qty > 0) items.push({ qty, uom: 'EA', sku: 'tmbrstnd116', description: `Triple Plate — ${name}`, group, is_dynamic_sku: false });
    }

    // ── Rim board (non-basement floor sections only) ──────────────────────────────
    if (!isBasement) {
        const perimLF =
            section.ext2x4_8ft + section.ext2x4_9ft + section.ext2x4_10ft +
            section.ext2x6_8ft + section.ext2x6_9ft + section.ext2x6_10ft;
        if (perimLF > 0) {
            const qty = Math.ceil(perimLF * multipliers.framing.rim_multiplier.value);
            if (qty > 0) items.push({ qty, uom: 'EA', sku: 'rimboard', description: `Rim Board — ${name}`, group, is_dynamic_sku: false });
        }
    }

    // ── Sill seal (basement exterior perimeter) ──────────────────────────────────
    if (isBasement) {
        const extPerimLF =
            section.ext2x4_8ft + section.ext2x4_9ft + section.ext2x4_10ft +
            section.ext2x6_8ft + section.ext2x6_9ft + section.ext2x6_10ft;
        if (extPerimLF > 0) {
            const lf_per_roll = multipliers.moisture_barrier?.sill_seal_roll_lf?.value ?? 50;
            const qty = Math.ceil(extPerimLF / lf_per_roll);
            if (qty > 0) items.push({ qty, uom: 'RL', sku: 'sillseal50', description: 'Sill Seal — Basement', group: 'Basement', is_dynamic_sku: false });
        }
    }

    // ── Tyvek / house wrap (non-basement exterior walls) ─────────────────────────
    if (!isBasement && inputs.materials.tyvekType !== 'N/A' && inputs.materials.tyvekType !== 'Tape Only') {
        const extWallSF =
            (section.ext2x4_8ft + section.ext2x6_8ft) * 8 +
            (section.ext2x4_9ft + section.ext2x6_9ft) * 9 +
            (section.ext2x4_10ft + section.ext2x6_10ft) * 10;

        if (extWallSF > 0) {
            // Check customer-specific Tyvek override
            const custOverride = customerOverrides?.tyvek_overrides?.find(
                (o: any) => o.customer_name === inputs.setup.customerName
            );

            if (inputs.materials.tyvekType === 'Standard 9ft') {
                const sku = custOverride?.force_height === '9ft' && custOverride?.tyvek_code
                    ? custOverride.tyvek_code
                    : 'tyvek9ft150';
                const qty = Math.ceil(extWallSF * multipliers.moisture_barrier.tyvek_9ft.value);
                if (qty > 0) items.push({ qty, uom: 'RL', sku, description: `Tyvek 9ft House Wrap — ${name}`, group, is_dynamic_sku: false });
            } else if (inputs.materials.tyvekType === 'Standard 10ft') {
                let sku = 'tyvek10ft150';
                if (custOverride) {
                    if (custOverride.force_height === '9ft' && custOverride.tyvek_code) sku = custOverride.tyvek_code;
                    else if (custOverride.force_height === 'auto' && custOverride.tyvek_code_10) sku = custOverride.tyvek_code_10;
                }
                const qty = Math.ceil(extWallSF * multipliers.moisture_barrier.tyvek_10ft.value);
                if (qty > 0) items.push({ qty, uom: 'RL', sku, description: `Tyvek 10ft House Wrap — ${name}`, group, is_dynamic_sku: false });
            } else if (inputs.materials.tyvekType === 'Zip Panels') {
                const qty = Math.ceil(extWallSF / 32);
                if (qty > 0) items.push({ qty, uom: 'EA', sku: 'zippanel48', description: `Zip System Panel — ${name}`, group, is_dynamic_sku: false });
            }
        }
    }

    // ── Engineered headers ────────────────────────────────────────────────────────
    if (section.headers?.length) {
        for (const h of section.headers) {
            if (h.count <= 0) continue;
            const length_ft = (h as any).length_ft ?? 12;
            const sku = engineeredLumber ? getLVLCode(h.size, length_ft, engineeredLumber) : `HDR-${h.size}-${length_ft}`;
            items.push({
                qty: h.count,
                uom: 'EA',
                sku,
                description: `${h.size} × ${length_ft}ft Engineered Header — ${name}`,
                group,
                is_dynamic_sku: true,
                tally: `${h.count}/${length_ft}ft`,
            });
        }
    }

    return items;
}
