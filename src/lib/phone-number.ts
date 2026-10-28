export function parseOptionalPhoneNumber(value: string) {
    const submitted = value.trim();
    if (!submitted) return { phoneNumber: null, valid: true };

    const phoneNumber = submitted.replace(/[\s().-]/g, "");
    return {
        phoneNumber,
        valid: /^\+[1-9]\d{7,14}$/.test(phoneNumber),
    };
}
