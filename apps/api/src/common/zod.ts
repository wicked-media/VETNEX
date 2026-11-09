import { BadRequestException } from "@nestjs/common";
import { ZodError, type ZodTypeAny, type z } from "zod";

export interface FieldErrors {
  [field: string]: string[];
}

export function fieldErrorsFrom(error: ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    const bucket = result[key] ?? [];
    bucket.push(issue.message);
    result[key] = bucket;
  }
  return result;
}

/**
 * Validates untrusted input against a shared Zod contract and converts failures
 * into a structured 400 that the web client can attach to individual fields.
 */
export function parseInput<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(result.error),
    });
  }
  return result.data;
}
