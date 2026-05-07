export function formatPhoneNumber(phone?: string | null) {
  if (!phone) {
    return "Non renseigné";
  }

  const cleaned = phone.replace(/\s+/g, "");

  if (!/^\+?\d+$/.test(cleaned)) {
    return phone;
  }

  if (cleaned.startsWith("+")) {
    const country = cleaned.slice(0, 3);
    const rest = cleaned.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    return `${country} ${rest}`.trim();
  }

  return cleaned.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
