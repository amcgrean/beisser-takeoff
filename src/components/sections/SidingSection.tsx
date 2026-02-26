import React from 'react';
import { SidingSection as SidingSectionType } from '../../types/estimate';
import { SectionCard, InputGroup } from '../ui/SectionCard';

interface Props {
    data: SidingSectionType;
    onChange: (data: SidingSectionType) => void;
}

export function SidingSectionComp({ data, onChange }: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        onChange({
            ...data,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        });
    };

    return (
        <SectionCard title="8. Siding">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InputGroup label="Lap Siding Type">
                    <select name="lapType" value={data.lapType} onChange={handleChange} className="input-field">
                        <option value="LP">LP</option>
                        <option value="Hardie">Hardie</option>
                        <option value="Vinyl">Vinyl</option>
                    </select>
                </InputGroup>
                <InputGroup label="Profile Size">
                    <input type="text" name="lapProfileSize" value={data.lapProfileSize} onChange={handleChange} className="input-field" placeholder="e.g. 8in" />
                </InputGroup>
                <InputGroup label="Lap SF">
                    <input type="number" name="lapSF" value={data.lapSF} onChange={handleChange} className="input-field" />
                </InputGroup>
                <InputGroup label="Soffit Type">
                    <select name="soffitType" value={data.soffitType} onChange={handleChange} className="input-field">
                        <option value="LP">LP</option>
                        <option value="Hardie">Hardie</option>
                        <option value="Rollex">Rollex</option>
                    </select>
                </InputGroup>
                <InputGroup label="Soffit SF">
                    <input type="number" name="soffitSF" value={data.soffitSF} onChange={handleChange} className="input-field" />
                </InputGroup>
            </div>
        </SectionCard>
    );
}
