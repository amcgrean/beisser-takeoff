import { LineItem, JobSetup } from '../types/estimate';

export function downloadCsv(items: LineItem[], setup: JobSetup) {
    const headers = ['Qty', 'UOM', 'ItemCode', 'Description', 'Group', 'JobName', 'Estimator', 'CustomerCode', 'ShipTo', 'Message', 'Tally'];

    const rows = items.map(item => [
        item.qty,
        item.uom,
        item.sku,
        item.description,
        item.group,
        setup.jobName,
        setup.estimatorName,
        setup.customerCode,
        '', // ShipTo
        '', // Message
        item.tally || ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `takeoff_${setup.jobName || 'estimate'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
