import React from 'react';
import { BearingWallSection } from '../../types/estimate';
import { SectionCard, InputGroup } from '../ui/SectionCard';

interface Props {
    data: BearingWallSection;
    onChange: (data: BearingWallSection) => void;
}

const HEIGHTS: BearingWallSection['height'][] = [8, 9, 10];
const STUD_SIZES: BearingWallSection['studSize'][] = ['2x4', '2x6'];

export function BearingWallSectionComp({ data, onChange }: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const el = e.target as HTMLInputElement;
        const val = el.type === 'number' ? parseFloat(el.value) || 0 : el.value;
        onChange({ ...data, [el.name]: val });
    };

    const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...data, lslStuds: e.target.checked });
    };

    return (
        <SectionCard title="Bearing Walls" accent="violet">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                <InputGroup label="Bearing Wall LF">
                    <input
                        type="number"
                        name="lf"
                        value={data.lf || ''}
                        onChange={handleChange}
                        className="input-field"
                        min="0"
                        placeholder="Lin ft"
                    />
                </InputGroup>
                <InputGroup label="Wall Height">
                    <select name="height" value={data.height} onChange={handleChange} className="input-field">
                        {HEIGHTS.map(h => <option key={h} value={h}>{h}ft</option>)}
                    </select>
                </InputGroup>
                <InputGroup label="Stud Size">
                    <select name="studSize" value={data.studSize} onChange={handleChange} className="input-field">
                        {STUD_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </InputGroup>
                <InputGroup label="LSL Studs (Timberstrand)">
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={data.lslStuds}
                            onChange={handleToggle}
                            className="accent-purple-400"
                        />
                        <span className="text-sm text-slate-300">Use LSL</span>
                    </label>
                </InputGroup>
            </div>
        </SectionCard>
    );
}
