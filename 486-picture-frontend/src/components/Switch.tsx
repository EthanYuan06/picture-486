import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, label }) => {
  return (
    <div className="flex items-center cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`
        relative w-10 h-5 rounded-full transition-colors duration-300 ease-in-out
        ${checked ? 'bg-primary' : 'bg-white/20'}
      `}>
        <div className={`
          absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `} />
      </div>
      {label && <span className="ml-2 text-sm text-white select-none">{label}</span>}
    </div>
  );
};

export default Switch;