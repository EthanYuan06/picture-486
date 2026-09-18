import React from 'react';

export enum ViewState {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  RESET_PASSWORD = 'RESET_PASSWORD',
  DASHBOARD = 'DASHBOARD'
}

export interface User {
  id: number;
  userAccount: string;
  userEmail: string;
  userName?: string;
  userAvatar?: string;
  userProfile?: string;
  userRole: string;
  createTime?: string;
}

export interface UserUpdateRequest {
  id: number;
  userName?: string;
  userAvatar?: string;
  userProfile?: string;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string; // Optional label for accessibility
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'text';
}