import React from 'react';
import { JobSetup } from '../../types/estimate';
import { SectionCard, InputGroup } from '../ui/SectionCard';

interface Props {
    data: JobSetup;
    onChange: (data: JobSetup) => void;
}

export function JobSetupSection({ data, onChange }: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onChange({ ...data, [e.target.name]: e.target.value });
    };

    return (
        <SectionCard title="1. Job Setup" defaultExpanded>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Branch">
                    <select
                        name="branch"
                        value={data.branch}
                        onChange={handleChange}
                        className="input-field"
                    >
                        <option value="grimes">Grimes</option>
                        <option value="fort_dodge">Fort Dodge</option>
                        <option value="coralville">Coralville</option>
                    </select>
                </InputGroup>
                <InputGroup label="Estimator Name">
                    <input
                        type="text"
                        name="estimatorName"
                        value={data.estimatorName}
                        onChange={handleChange}
                        className="input-field"
                    />
                </InputGroup>
                <InputGroup label="Customer Name">
                    <input
                        type="text"
                        name="customerName"
                        value={data.customerName}
                        onChange={handleChange}
                        className="input-field"
                    />
                </InputGroup>
                <InputGroup label="Job Name">
                    <input
                        type="text"
                        name="jobName"
                        value={data.jobName}
                        onChange={handleChange}
                        className="input-field"
                    />
                </InputGroup>
            </div>
        </SectionCard>
    );
}
