import { SurveyGameOption } from '../constants';
import { useTranslation } from '../../../../state/languageContext';

interface GamePreferenceSelectorProps {
  options: SurveyGameOption[];
  selectedGames: string[];
  onToggle: (game: string) => void;
  exclusiveNote?: string;
}

const GamePreferenceSelector = ({
  options,
  selectedGames,
  onToggle,
  exclusiveNote,
}: GamePreferenceSelectorProps) => {
  const { t } = useTranslation();
  const categories = Array.from(new Set(options.map(option => option.category)));
  const exclusiveLabel = exclusiveNote ?? t('survey.selector.exclusive', '선택 시 탈락');

  return (
    <div className="chip-grid">
      {categories.map(category => (
        <div key={category} className="chip-group">
          <p className="hint-text">
            [{t(`survey.selector.category.${category}`, category)}]
          </p>
          <div className="chip-grid">
            {options
              .filter(option => option.category === category)
              .map(option => {
                const isSelected = selectedGames.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => onToggle(option.value)}
                  >
                    {option.label}
                    {option.exclusive && <span className="chip-note">{exclusiveLabel}</span>}
                    {option.requiresDetail && (
                      <span className="chip-note">
                        {t('survey.selector.requiresDetail', '주력 FPS 직접 기재')}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GamePreferenceSelector;