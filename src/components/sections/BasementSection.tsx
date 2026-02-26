import React from 'react';
import { BasementSection } from '../../types/estimate';
import { SectionCard, InputGroup } from '../ui/SectionCard';

interface Props {
    data: BasementSection;
    onChange: (data: BasementSection) => void;
}

export function BasementSectionComp({ data, onChange }: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onChange({ ...data, [name]: parseFloat(value) || 0 });
    };

    return (
        <SectionCard title="3. Basement Section">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InputGroup label="Ext 2x4 LF (8ft)">
                    <input type="number" name="ext2x4_8ft" value={data.ext2x4_8ft} onChange={handleChange} className="input-field" />
                </InputGroup>
                <InputGroup label="Ext 2x4 LF (9ft)">
                    <input type="number" name="ext2x4_9ft" value={data.ext2x4_9ft} onChange={handleChange} className="input-field" />
                </InputGroup>
                <InputGroup label="Ext 2x6 LF (8ft)">
                    <input type="number" name="ext2x6_8ft" value={data.ext2x6_8ft} onChange={handleChange} className="input-field" />
                </InputGroup>
                <InputGroup label="Int Wall LF">
                    <input type="number" name="intWallLF" value={data.intWallLF} onChange={handleChange} className="input-field" />
                </InputGroup>
                <InputGroup label="Beam LF">
                    <input type="number" name="beamLF" value={data.beamLF} onChange={handleChange} className="input-field" />
                </InputGroup>
            </div>
        </SectionCard>
    );
}
