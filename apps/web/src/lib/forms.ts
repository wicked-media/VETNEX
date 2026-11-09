"use client";

import { useState, type ChangeEvent } from "react";
import type { ZodType, ZodTypeDef } from "zod";
import { ClientApiError } from "./client-api";

export type FieldErrors = Record<string, string[]>;

export interface FormState<TOutput, TInput> {
  values: TInput;
  update: <K extends keyof TInput>(field: K, value: TInput[K]) => void;
  bind: <K extends keyof TInput>(field: K) => {
    value: string;
    onChange: (
      event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => void;
    "aria-invalid": boolean | undefined;
  };
  errors: FieldErrors;
  formError: string | null;
  setFormError: (message: string | null) => void;
  submitting: boolean;
  submit: (handler: (parsed: TOutput) => Promise<void>) => Promise<void>;
}

/**
 * Minimal typed form state backed by the same Zod schema the API uses.
 *
 * One schema validates on both sides, and API field errors are merged into the same
 * error map, so a user never sees a client-side rule that disagrees with the server.
 * (React Hook Form is deferred until the multi-step clinical forms land.)
 */
export function useForm<TInput extends Record<string, unknown>, TOutput>(
  schema: ZodType<TOutput, ZodTypeDef, TInput>,
  initial: TInput,
): FormState<TOutput, TInput> {
  const [values, setValues] = useState<TInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof TInput>(field: K, value: TInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function bind<K extends keyof TInput>(field: K) {
    return {
      value: values[field] === undefined || values[field] === null ? "" : String(values[field]),
      onChange: (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
      ) => update(field, event.target.value as TInput[K]),
      "aria-invalid": Boolean(errors[field as string]?.length) || undefined,
    };
  }

  async function submit(handler: (parsed: TOutput) => Promise<void>) {
    setErrors({});
    setFormError(null);

    const result = schema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
        (next[key] ??= []).push(issue.message);
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await handler(result.data);
    } catch (error) {
      if (error instanceof ClientApiError) {
        if (error.fieldErrors) setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError(error instanceof Error ? error.message : "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { values, update, bind, errors, formError, setFormError, submitting, submit };
}
