import React from 'react';
import { FloorSection, HeaderEntry } from '../../types/estimate';
import { SectionCard, InputGroup } from '../ui/SectionCard';

interface Props {
    sectionNumber: number;
    title: string;
    data: FloorSection;
    onChange: (data: FloorSection) => void;
}

const DECK_TYPES   = ['Edge T&G','Gold Edge','Advantech','Diamond'] as const;
const TJI_SIZES    = ['9-1/2','11-7/8','14','16','18','20'];
const HEADER_SIZES = ['2x8','2x10','2x12','1.75x7.25','1.75x9.5','1.75x11.78','1.75x14','1.75x16','1.75x18','3.5x9','3.5x11'];

function lengthsFor(size: string): number[] {
    return size.startsWith('2x') ? [8,10,12,14,16,18,20] : [8,10,12,14,16,18,20,22,24,26,28,30,32];
}

export function FloorSectionComp({ sectionNumber, title, data, onChange }: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const el = e.target as HTMLInputElement;
        onChange({ ...data, [el.name]: el.type === 'number' ? parseFloat(el.value) || 0 : el.value });
    };

    const handleHeader = (i: number, field: keyof HeaderEntry, value: string) => {
        const next = data.headers.map((h, idx) =>
            idx !== i ? h : { ...h, [field]: field === 'size' ? value : parseInt(value) || 0 }
        );
        onChange({ ...data, headers: next });
    };

    const addHeader    = () => onChange({ ...data, headers: [...data.headers, { size: '2x8', length_ft: 12, count: 0 }] });
    const removeHeader = (i: number) => onChange({ ...data, headers: data.headers.filter((_, idx) => idx !== i) });

    return (
        <SectionCard title={`${sectionNumber}. ${title}`}>
            <div className="space-y-5">
                {/* Deck */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Deck</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup label="Deck SF">
                            <input type="number" name="deckSF" value={data.deckSF || ''} onChange={handleChange} className="input-field" min="0" />
                        </InputGroup>
                        <InputGroup label="Deck Type">
                            <select name="deckType" value={data.deckType} onChange={handleChange} className="input-field">
                                {DECK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </InputGroup>
                        <InputGroup label="TJI / I-Joist Size">
                            <select name="tjiSize" value={data.tjiSize} onChange={handleChange} className="input-field">
                                {TJI_SIZES.map(s => <option key={s} value={s}>{s}"</option>)}
                            </select>
                        </InputGroup>
                        <InputGroup label="TJI / I-Joist Count">
                            <input type="number" name="tjiCount" value={data.tjiCount || ''} onChange={handleChange} className="input-field" min="0" placeholder="Enter joist count" />
                        </InputGroup>
                    </div>
                </div>

                {/* Exterior walls */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Exterior Walls (LF by height)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {(['ext2x4_8ft','ext2x4_9ft','ext2x4_10ft','ext2x6_8ft','ext2x6_9ft','ext2x6_10ft'] as const).map(f => (
                            <InputGroup key={f} label={f.replace('ext','').replace('_',' @ ').replace('ft','ft').replace('2x4',' 2x4').replace('2x6',' 2x6').trim()}>
                                <input type="number" name={f} value={(data as any)[f] || ''} onChange={handleChange} className="input-field" min="0" />
                            </InputGroup>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputGroup label="Int Wall LF">    <input type="number" name="intWallLF"    value={data.intWallLF    || ''} onChange={handleChange} className="input-field" min="0" /></InputGroup>
                    <InputGroup label="Garage Wall LF"> <input type="number" name="garageWallLF" value={data.garageWallLF || ''} onChange={handleChange} className="input-field" min="0" /></InputGroup>
                    <InputGroup label="Beam LF">        <input type="number" name="beamLF"       value={data.beamLF       || ''} onChange={handleChange} className="input-field" min="0" /></InputGroup>
                    <InputGroup label="Stair Count">    <input type="number" name="stairCount"   value={data.stairCount   || ''} onChange={handleChange} className="input-field" min="0" /></InputGroup>
                </div>

                {/* Engineered Headers */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-300">Engineered Headers</h3>
                        <button onClick={addHeader} className="text-xs px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition">+ Add Header</button>
                    </div>
                    {data.headers.length === 0 && <p className="text-xs text-slate-500 italic">No headers added.</p>}
                    <div className="space-y-2">
                        {data.headers.map((h, i) => (
                            <div key={i} className="flex gap-2 items-center flex-wrap">
                                <select value={h.size} onChange={e => handleHeader(i, 'size', e.target.value)} className="input-field flex-1 min-w-[130px]">
                                    {HEADER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select value={h.length_ft} onChange={e => handleHeader(i, 'length_ft', e.target.value)} className="input-field w-24">
                                    {lengthsFor(h.size).map(l => <option key={l} value={l}>{l}ft</option>)}
                                </select>
                                <input type="number" value={h.count || ''} onChange={e => handleHeader(i, 'count', e.target.value)} className="input-field w-20" placeholder="Qty" min="0" />
                                <button onClick={() => removeHeader(i)} className="text-slate-500 hover:text-red-400 text-lg leading-none">×</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SectionCard>
    );
}
