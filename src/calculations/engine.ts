import { JobInputs, LineItem, Multipliers } from '../types/estimate';
import { calculateFraming } from './framing';
import { calculateSiding } from './siding';
import { calculateHardware } from './hardware';

export function calculateEstimate(
    inputs: JobInputs,
    data: {
        multipliers: Multipliers;
        hardwareMatrix: any;
        hardwareLookup: any;
    }
): LineItem[] {
    let allItems: LineItem[] = [];

    // Basement
    allItems = allItems.concat(calculateFraming('Basement', inputs.basement, inputs, data.multipliers));

    // First Floor
    allItems = allItems.concat(calculateFraming('1st Floor', inputs.firstFloor, inputs, data.multipliers));

    // Second Floor
    allItems = allItems.concat(calculateFraming('2nd Floor', inputs.secondFloor, inputs, data.multipliers));

    // Siding
    allItems = allItems.concat(calculateSiding(inputs.siding, inputs, data.multipliers));

    // Hardware
    allItems = allItems.concat(calculateHardware(inputs.hardware, inputs, data.hardwareMatrix, data.hardwareLookup));

    // Filter out zero quantities
    return allItems.filter(item => item.qty > 0);
}
