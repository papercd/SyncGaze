import { ChangeEvent } from 'react';

type EligibilityField = 'ageCheck' | 'webcamCheck';

interface EligibilityChecklistProps {
  values: Record<EligibilityField, boolean>;
  onToggle: (field: EligibilityField, checked: boolean) => void;
  labelOverrides?: Partial<Record<EligibilityField, string>>;
}

const defaultLabels: Record<EligibilityField, string> = {
  ageCheck: '서비스 이용을 위한 기본 PC/네트워크 환경이 준비되었습니다.',
  webcamCheck: '시선 추적에 사용할 수 있는 웹캠 또는 카메라가 준비되었습니다.',
};

const EligibilityChecklist = ({ values, onToggle, labelOverrides }: EligibilityChecklistProps) => {
  const fields: EligibilityField[] = ['ageCheck', 'webcamCheck'];

  const handleChange = (field: EligibilityField) => (event: ChangeEvent<HTMLInputElement>) => {
    onToggle(field, event.target.checked);
  };

  return (
    <>
      {fields.map(field => (
        <label key={field} className="checkbox-row">
          <input type="checkbox" checked={values[field]} onChange={handleChange(field)} />
          {labelOverrides?.[field] ?? defaultLabels[field]}
        </label>
      ))}
    </>
  );
};

export default EligibilityChecklist;
