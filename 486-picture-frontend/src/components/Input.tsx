import React from 'react';
import { InputProps } from '../types';

const Input: React.FC<InputProps> = ({ icon, className, ...props }) => {
  return (
    <div className="relative group w-full mb-4">
      <input
        className={`
          w-full 
          bg-white/20 
          backdrop-blur-md
          border 
          border-white/30
          rounded-xl 
          py-3 
          ${icon ? 'pl-10' : 'pl-4'} 
          pr-4 
          text-white 
          placeholder-white/70
          outline-none 
          focus:border-white/40
          focus:bg-white/25
          transition-all 
          duration-300 
          shadow-lg 
          shadow-black/5
          ${className || ''}
        `}
        {...props}
      />
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-200 group-focus-within:text-white transition-colors duration-300 pointer-events-none z-10">
          {icon}
        </div>
      )}
    </div>
  );
};

export default Input;