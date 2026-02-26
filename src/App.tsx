import React, { useEffect, useState } from 'react';
import { initializeData, dataCache } from './utils/lookup';
import { JobInputs, LineItem } from './types/estimate';
import { calculateEstimate } from './calculations/engine';
import { JobSetupSection } from './components/sections/JobSetupSection';
import { MaterialSelectionSection } from './components/sections/MaterialSelectionSection';
import { BasementSectionComp } from './components/sections/BasementSection';
import { SidingSectionComp } from './components/sections/SidingSection';
import { HardwareSectionComp } from './components/sections/HardwareSection';

import { downloadCsv } from './utils/export';
import { BidSummary } from './components/BidSummary';

const initialInputs: JobInputs = {
    setup: { branch: 'grimes', estimatorName: '', customerName: '', customerCode: '', jobName: '' },
    materials: { plateType: 'Treated', wallSize: '2x4', triplePlate: false, tyvekType: 'Standard 9ft', roofSheetingSize: '7/16 OSB' },
    basement: { ext2x4_8ft: 0, ext2x4_9ft: 0, ext2x4_10ft: 0, ext2x6_8ft: 0, ext2x6_9ft: 0, ext2x6_10ft: 0, intWallLF: 0, beamLF: 0, stairCount: 0, headers: [], fhaCeilingHeight: 0, stoopJoistSize: '2x8' },
    firstFloor: { ext2x4_8ft: 0, ext2x4_9ft: 0, ext2x4_10ft: 0, ext2x6_8ft: 0, ext2x6_9ft: 0, ext2x6_10ft: 0, intWallLF: 0, beamLF: 0, stairCount: 0, headers: [], deckSF: 0, deckType: 'Edge T&G', tjiSize: '11-7/8', garageWallLF: 0 },
    secondFloor: { ext2x4_8ft: 0, ext2x4_9ft: 0, ext2x4_10ft: 0, ext2x6_8ft: 0, ext2x6_9ft: 0, ext2x6_10ft: 0, intWallLF: 0, beamLF: 0, stairCount: 0, headers: [], deckSF: 0, deckType: 'Edge T&G', tjiSize: '11-7/8', garageWallLF: 0 },
    roof: { sheetingSF: 0, postCount: 0, postSize: '4x4', headerSize: '2x8', headerCount: 0, soffitOverhang: 12 },
    shingles: { sf: 0, ridgeLF: 0, hipLF: 0 },
    siding: { lapType: 'LP', lapProfileSize: '8in', lapSF: 0, shakeType: 'N/A', shakeSF: 0, soffitType: 'LP', soffitSF: 0, porchSoffitType: 'N/A', porchSoffitSF: 0, trimBoardType: 'N/A', trimBoardLF: 0, cornerType: 'N/A', cornerCount: 0, splicers: false },
    trim: { baseType: '', caseType: '', doorCounts: { single68: 0, single80: 0, double30: 0, double40: 0, double50: 0, bifold40: 0, bifold50: 0, bifold30: 0 }, windowCount: 0, windowLF: 0, handrailType: '', handrailLF: 0 },
    hardware: { type: '', counts: { keyed: 0, passage: 0, privacy: 0, dummy: 0, deadbolt: 0, handleset: 0, stopHinged: 0, stopSpring: 0, fingerPull: 0, bifoldKnob: 0, pocketLock: 0, insideTrim: 0 } },
    exteriorDeck: { joistSize: '2x8', beamSize: '2x10', deckingType: 'Treated', deckingLengths: [], railingStyle: 'Treated', railingLF: 0, postCount: 0, stairCount: 0, landing: false },
    windowsDoors: { windowCount: 0, doorCount: 0 },
    options: []
};

export default function App() {
    const [loading, setLoading] = useState(true);
    const [inputs, setInputs] = useState<JobInputs>(initialInputs);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [view, setView] = useState<'takeoff' | 'summary'>('takeoff');

    useEffect(() => {
        initializeData().then(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!loading) {
            const items = calculateEstimate(inputs, {
                multipliers: dataCache.multipliers,
                hardwareMatrix: dataCache.hardwareMatrix,
                hardwareLookup: dataCache.hardwareLookup,
            });
            setLineItems(items);
        }
    }, [inputs, loading]);

    const handleExport = () => {
        downloadCsv(lineItems, inputs.setup);
    };

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading takeoff data...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            House Estimator <span className="text-blue-600">Takeoff</span>
                        </h1>
                        <p className="text-slate-500 font-medium">Beisser Lumber Co. Digital Estimator</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView(view === 'takeoff' ? 'summary' : 'takeoff')}
                            className="px-4 py-2 rounded-lg font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                            {view === 'takeoff' ? 'Show Bid Summary' : 'Back to Takeoff'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={lineItems.length === 0}
                            className="px-6 py-2 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-md disabled:bg-slate-300 disabled:shadow-none"
                        >
                            Export Agility CSV
                        </button>
                    </div>
                </header>

                {view === 'takeoff' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <JobSetupSection data={inputs.setup} onChange={(val) => setInputs({ ...inputs, setup: val })} />
                            <MaterialSelectionSection data={inputs.materials} onChange={(val) => setInputs({ ...inputs, materials: val })} />
                            <BasementSectionComp data={inputs.basement} onChange={(val) => setInputs({ ...inputs, basement: val })} />
                            <SidingSectionComp data={inputs.siding} onChange={(val) => setInputs({ ...inputs, siding: val })} />
                            <HardwareSectionComp data={inputs.hardware} lookups={dataCache.hardwareLookup} onChange={(val) => setInputs({ ...inputs, hardware: val })} />
                        </div>

                        <div className="lg:col-span-1">
                            <div className="card sticky top-8 border-none ring-1 ring-slate-200">
                                <div className="p-4 bg-slate-800 font-bold text-white flex justify-between items-center">
                                    <span>Estimate Review</span>
                                    <span className="bg-blue-500 px-2 py-0.5 rounded text-xs">{lineItems.length} items</span>
                                </div>
                                <div className="p-0 divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                                    {lineItems.length === 0 && (
                                        <div className="p-8 text-center">
                                            <p className="text-slate-400 text-sm italic">No items yet. Enter some dimensions to see your estimate.</p>
                                        </div>
                                    )}
                                    {lineItems.map((item, idx) => (
                                        <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-semibold text-slate-800 text-sm leading-tight">{item.description}</span>
                                                <span className="font-bold text-blue-600 text-sm whitespace-nowrap ml-2">{item.qty} {item.uom}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{item.sku}</span>
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.group}</span>
                                            </div>
                                            {item.warning && (
                                                <div className="mt-2 text-[11px] bg-red-50 text-red-600 p-2 rounded border border-red-100 font-medium animate-pulse">
                                                    {item.warning}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <BidSummary inputs={inputs} lineItems={lineItems} />
                )}
            </div>
        </div>
    );
}
