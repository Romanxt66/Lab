"use server";

import { type Result, ok, err } from "@/shared/kernel/result";
import { getSendWhatsApp, getWhatsAppConfigRepo } from "@/shared/di/container";
import {
  normalisePhone,
  toWhatsAppConfigDTO,
  type WhatsAppConfigDTO,
} from "@/modules/whatsapp/domain/config";

export async function getActiveWhatsAppConfigAction(): Promise<WhatsAppConfigDTO | null> {
  const c = await getWhatsAppConfigRepo().getActive();
  return c ? toWhatsAppConfigDTO(c) : null;
}

export async function saveWhatsAppConfigAction(input: {
  phone: string;
  apiKey: string;
}): Promise<Result<WhatsAppConfigDTO>> {
  const phone = normalisePhone(input.phone);
  if (!phone.ok) return phone;
  if (!input.apiKey.trim()) return err("Introduce la API key de CallMeBot.");
  const saved = await getWhatsAppConfigRepo().upsert({
    provider: "callmebot",
    phone: phone.value,
    apiKey: input.apiKey.trim(),
    active: true,
  });
  return ok(toWhatsAppConfigDTO(saved));
}

export async function deleteWhatsAppConfigAction(id: string): Promise<void> {
  await getWhatsAppConfigRepo().remove(id);
}

export async function sendWhatsAppTestAction(): Promise<Result<void>> {
  return getSendWhatsApp().execute(
    "Prueba desde Lab ✅ La integración con WhatsApp funciona.",
  );
}
