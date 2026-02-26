import React, { useState } from 'react';
import { JobInputs, LineItem } from '../types/estimate';

interface Props {
    inputs: JobInputs;
    lineItems: LineItem[];
}

export function BidSummary({ inputs, lineItems }: Props) {
    const [groupPrices, setGroupPrices] = useState<Record<string, number>>({});

    const groups = Array.from(new Set(lineItems.map(item => item.group)));

    const handlePriceChange = (group: string, price: string) => {
        setGroupPrices({ ...groupPrices, [group]: parseFloat(price) || 0 });
    };

    const subtotal = Object.values(groupPrices).reduce((a, b) => a + b, 0);
    const tax = subtotal * 0.07;
    const total = subtotal + tax;

    return (
        <div className="card p-8 bg-white shadow-lg max-w-4xl mx-auto my-8 print:shadow-none print:my-0">
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">Estimate Bid Summary</h1>
                    <p className="text-slate-500">Beisser Lumber Co.</p>
                </div>
                <div className="text-right text-sm">
                    <p><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</p>
                    <p><span className="font-semibold">Estimator:</span> {inputs.setup.estimatorName}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Customer</h3>
                    <p className="text-lg font-semibold">{inputs.setup.customerName}</p>
                    <p className="text-sm text-slate-500">Code: {inputs.setup.customerCode}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Job Name</h3>
                    <p className="text-lg font-semibold">{inputs.setup.jobName}</p>
                </div>
            </div>

            <table className="w-full mb-8">
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="text-left py-2 text-sm font-bold text-slate-600">Material Group</th>
                        <th className="text-right py-2 text-sm font-bold text-slate-600 w-32">Price ($)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {groups.map(group => (
                        <tr key={group}>
                            <td className="py-2 text-slate-700">{group}</td>
                            <td className="py-2">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={groupPrices[group] || ''}
                                    onChange={(e) => handlePriceChange(group, e.target.value)}
                                    className="w-full text-right border-none focus:ring-0 text-slate-900 p-0 print:placeholder-transparent"
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold">
                        <td className="py-3 text-slate-900">Subtotal</td>
                        <td className="py-3 text-right">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td className="py-1 text-slate-500 font-normal">Sales Tax (7%)</td>
                        <td className="py-1 text-right text-slate-500 font-normal">${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="text-xl font-bold text-blue-600">
                        <td className="py-4">Bid Total</td>
                        <td className="py-4 text-right">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                <p>This estimate is valid for 30 days. Prices subject to change based on market fluctuations.</p>
            </div>
        </div>
    );
}
