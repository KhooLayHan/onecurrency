import { z } from "zod";

export const hexString32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const ethereumAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const chainIdSchema = z.enum(["31337", "11155111"]);
