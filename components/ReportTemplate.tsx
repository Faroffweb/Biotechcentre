import React from 'react';
import { formatDate } from '../hooks/lib/utils';
import { ExportReportItem } from '../types';

interface ReportTemplateProps {
    data: ExportReportItem[];
    startDate: string;
    endDate: string;
    companyName: string;
}

const ReportTemplate = React.forwardRef<HTMLDivElement, ReportTemplateProps>(({ data, startDate, endDate, companyName }, ref) => {
    const styles = `
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #333; }
        .page { width: 210mm; min-height: 297mm; padding: 20mm; margin: 0 auto; background: #fff; box-sizing: border-box; }
        h1, h2 { text-align: center; margin: 0; }
        h1 { font-size: 24px; margin-bottom: 5px; }
        h2 { font-size: 16px; font-weight: normal; margin-bottom: 20px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .number { text-align: right; }
        .positive { color: #28a745; }
        .negative { color: #dc3545; }
    `;

    return (
        <div ref={ref}>
            <style>{styles}</style>
            <div className="page">
                <h1>{companyName}</h1>
                <h2>Product Report ({formatDate(startDate)} to {formatDate(endDate)})</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Product</th>
                            <th className="number">Quantity</th>
                            <th>Reference #</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => (
                            <tr key={index}>
                                <td>{formatDate(item.transaction_date)}</td>
                                <td>{item.transaction_type}</td>
                                <td>{item.product_name}</td>
                                <td className={`number ${item.quantity_change > 0 ? 'positive' : 'negative'}`}>
                                    {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
                                </td>
                                <td>{item.reference_number || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

export default ReportTemplate;
