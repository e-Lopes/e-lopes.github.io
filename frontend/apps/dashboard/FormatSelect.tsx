import { Select } from '../../shared/Select';
export function FormatSelect({
    formats,
    value,
    onChange
}: {
    formats: { code: string; name: string }[];
    value: string;
    onChange(value: string): void;
}) {
    return (
        <Select
            label="Formato em destaque"
            value={value}
            onChange={onChange}
            options={formats.map((format) => ({
                value: format.code,
                label:
                    format.name && format.name !== format.code
                        ? format.name + ' - ' + format.code
                        : format.code
            }))}
        />
    );
}
