/**
 * @file
 * Gestiona validación y errores por campo según modo de autenticación. Traduce errores de API
 * y limpia mensajes al editar.
 */
import { useState } from 'react';
import { ApiError } from '../../data/api-client';
import { errorMessage } from '../../domain/format';

export type AuthMode = 'login' | 'register' | 'verify' | 'social';
type AuthField =
  | 'email'
  | 'password'
  | 'confirmation'
  | 'firstName'
  | 'lastName'
  | 'dni'
  | 'code';
type FieldErrors = Partial<Record<AuthField, string>>;

type AuthValues = Record<AuthField, string>;

// Centraliza validación y mensajes de campos según el paso de autenticación.
export function useLoginErrors(mode: AuthMode) {
  const [localError, setLocalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Edita el campo y limpia su error; cambiar contraseña limpia también el de confirmación.
  function changeField(field: AuthField, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setFieldErrors((current) => ({
        ...current,
        [field]: undefined,
        ...(field === 'password' ? { confirmation: undefined } : {}),
      }));
    };
  }

  // Borra mensajes generales y de campos antes de otro intento.
  function clearErrors() {
    setLocalError('');
    setFieldErrors({});
  }

  // Traduce códigos de API a errores de campos o muestra un mensaje general.
  function handleError(cause: unknown, fieldFeedback = false) {
    const errors: FieldErrors = {};
    if (fieldFeedback && cause instanceof ApiError) {
      if (cause.code === 'INVALID_CREDENTIALS') {
        errors.email = errors.password = cause.message;
      } else if (cause.code === 'INVALID_CODE') {
        errors.code = cause.message;
      } else if (cause.code === 'VALIDATION_ERROR') {
        const messages: Record<AuthField, string> = {
          email: 'Ingresá un email válido.',
          password:
            mode === 'register'
              ? 'La contraseña debe tener entre 12 y 128 caracteres.'
              : 'Ingresá tu contraseña (hasta 128 caracteres).',
          confirmation: 'Las contraseñas no coinciden.',
          firstName: 'Ingresá un nombre de hasta 100 caracteres.',
          lastName: 'Ingresá un apellido de hasta 100 caracteres.',
          dni: 'Ingresá un DNI de entre 5 y 15 dígitos.',
          code: 'Ingresá el código de seis dígitos.',
        };
        for (const field of Object.keys(messages) as AuthField[]) {
          if (new RegExp(`(?:^|; )${field}:`).test(cause.message))
            errors[field] = messages[field];
        }
      }
    }
    if (Object.keys(errors).length) setFieldErrors(errors);
    else setLocalError(errorMessage(cause));
  }

  // Comprueba los campos requeridos por el modo actual antes de enviar la solicitud.
  function validate({
    email,
    password,
    confirmation,
    firstName,
    lastName,
    dni,
    code,
  }: AuthValues) {
    const errors: FieldErrors = {};
    if (mode === 'login' || mode === 'register') {
      if (!email.trim()) errors.email = 'Ingresá tu email.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        errors.email = 'Ingresá un email válido.';
      if (!password) errors.password = 'Ingresá tu contraseña.';
    }
    if (mode === 'register' || mode === 'social') {
      if (!firstName.trim()) errors.firstName = 'Ingresá tu nombre.';
      if (!lastName.trim()) errors.lastName = 'Ingresá tu apellido.';
      if (
        !/^[\d.\s-]{5,20}$/.test(dni) ||
        !/^\d{5,15}$/.test(dni.replace(/[.\s-]/g, ''))
      )
        errors.dni = 'Ingresá un DNI de entre 5 y 15 dígitos.';
    }
    if (mode === 'register') {
      if (password && password.length < 8)
        errors.password = 'La contraseña debe tener al menos 8 caracteres.';
      if (!confirmation) errors.confirmation = 'Repetí tu contraseña.';
      else if (password !== confirmation)
        errors.confirmation = 'Las contraseñas no coinciden.';
    }
    if (mode === 'verify' && !/^\d{6}$/.test(code))
      errors.code = 'Ingresá el código de seis dígitos.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return false;
    }
    return true;
  }

  return {
    localError,
    fieldErrors,
    changeField,
    clearErrors,
    handleError,
    validate,
  };
}
