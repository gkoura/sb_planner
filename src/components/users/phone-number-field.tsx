"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const countryCallingCodes = [
    { name: "Greece", code: "+30" },
    { name: "Cyprus", code: "+357" },
    { name: "Albania", code: "+355" },
    { name: "Bulgaria", code: "+359" },
    { name: "Turkey", code: "+90" },
    { name: "United Kingdom", code: "+44" },
    { name: "Ireland", code: "+353" },
    { name: "United States / Canada", code: "+1" },
    { name: "Germany", code: "+49" },
    { name: "France", code: "+33" },
    { name: "Italy", code: "+39" },
    { name: "Spain", code: "+34" },
    { name: "Portugal", code: "+351" },
    { name: "Netherlands", code: "+31" },
    { name: "Belgium", code: "+32" },
    { name: "Austria", code: "+43" },
    { name: "Switzerland", code: "+41" },
    { name: "Sweden", code: "+46" },
    { name: "Norway", code: "+47" },
    { name: "Denmark", code: "+45" },
    { name: "Finland", code: "+358" },
    { name: "Poland", code: "+48" },
    { name: "Romania", code: "+40" },
    { name: "Hungary", code: "+36" },
    { name: "Czechia", code: "+420" },
    { name: "Slovakia", code: "+421" },
    { name: "Slovenia", code: "+386" },
    { name: "Croatia", code: "+385" },
    { name: "Serbia", code: "+381" },
    { name: "Bosnia and Herzegovina", code: "+387" },
    { name: "Montenegro", code: "+382" },
    { name: "North Macedonia", code: "+389" },
    { name: "Ukraine", code: "+380" },
    { name: "Russia / Kazakhstan", code: "+7" },
    { name: "Israel", code: "+972" },
    { name: "United Arab Emirates", code: "+971" },
    { name: "Saudi Arabia", code: "+966" },
    { name: "Egypt", code: "+20" },
    { name: "South Africa", code: "+27" },
    { name: "India", code: "+91" },
    { name: "China", code: "+86" },
    { name: "Japan", code: "+81" },
    { name: "South Korea", code: "+82" },
    { name: "Australia", code: "+61" },
    { name: "New Zealand", code: "+64" },
    { name: "Brazil", code: "+55" },
    { name: "Mexico", code: "+52" },
    { name: "Argentina", code: "+54" },
    { name: "Singapore", code: "+65" },
    { name: "Philippines", code: "+63" },
    { name: "Thailand", code: "+66" },
];

function getInitialPhoneParts(phoneNumber: string | null) {
    if (!phoneNumber) return { countryCode: "+30", localNumber: "" };

    const matchingCountry = [...countryCallingCodes]
        .sort((left, right) => right.code.length - left.code.length)
        .find(({ code }) => phoneNumber.startsWith(code));

    if (!matchingCountry) {
        return { countryCode: "saved", localNumber: "" };
    }

    return {
        countryCode: matchingCountry.code,
        localNumber: phoneNumber.slice(matchingCountry.code.length),
    };
}

function getSubmittedPhoneNumber(countryCode: string, localNumber: string) {
    const trimmedNumber = localNumber.trim();
    const digits = trimmedNumber.replace(/\D/g, "");
    const dialCodeDigits = countryCode.slice(1);
    const localDigits = trimmedNumber.startsWith(countryCode)
        ? digits.slice(dialCodeDigits.length)
        : trimmedNumber.startsWith(`00${dialCodeDigits}`)
          ? digits.slice(dialCodeDigits.length + 2)
          : digits;

    return localDigits ? `${countryCode}${localDigits}` : "";
}

export function PhoneNumberField({
    defaultValue = null,
    idPrefix,
}: {
    defaultValue?: string | null;
    idPrefix: string;
}) {
    const initial = getInitialPhoneParts(defaultValue);
    const [countryCode, setCountryCode] = useState(initial.countryCode);
    const [localPhoneNumber, setLocalPhoneNumber] = useState(
        initial.localNumber,
    );
    const hasUnmatchedSavedNumber = countryCode === "saved";

    return (
        <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-number`}>
                Phone number{" "}
                <span className="text-muted-foreground font-normal">
                    (optional)
                </span>
            </Label>
            <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-2">
                <select
                    aria-label="Phone country code"
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 min-w-0 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
                    onChange={(event) =>
                        setCountryCode(event.currentTarget.value)
                    }
                    value={countryCode}
                >
                    {hasUnmatchedSavedNumber ? (
                        <option value="saved">Keep saved number</option>
                    ) : null}
                    {countryCallingCodes.map(({ name, code }) => (
                        <option key={name} value={code}>
                            {name} ({code})
                        </option>
                    ))}
                </select>
                <Input
                    autoComplete="tel-national"
                    disabled={hasUnmatchedSavedNumber}
                    id={`${idPrefix}-number`}
                    inputMode="tel"
                    onChange={(event) =>
                        setLocalPhoneNumber(event.currentTarget.value)
                    }
                    placeholder="6912345678"
                    type="tel"
                    value={localPhoneNumber}
                />
            </div>
            <input
                name="phoneNumber"
                type="hidden"
                value={
                    hasUnmatchedSavedNumber
                        ? (defaultValue ?? "")
                        : getSubmittedPhoneNumber(countryCode, localPhoneNumber)
                }
            />
            <p className="text-muted-foreground text-xs">
                {hasUnmatchedSavedNumber
                    ? `Saved number: ${defaultValue}. Choose a country code to replace it.`
                    : "Select a country code, then enter the local number. Your team can see it on standby schedules."}
            </p>
        </div>
    );
}
