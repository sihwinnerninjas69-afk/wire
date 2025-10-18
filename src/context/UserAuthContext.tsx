import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { sendOTP, verifyOTP } from "@/lib/phone-auth";

const USER_AUTH_STORAGE_KEY = "wirebazaar-user";

type UserProfile = {
  id: string;
  phoneNumber: string;
  lastLoginAt: string;
};

type UserAuthContextValue = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  requestOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<void>;
  logout: () => void;
};

const UserAuthContext = createContext<UserAuthContextValue | undefined>(undefined);

const isValidPhone = (value: string) => {
  return /^[6-9]\d{9}$/.test(value.trim().replace(/[\s-]/g, ''));
};

export const UserAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_AUTH_STORAGE_KEY);
      if (!stored) return;
      const parsed: UserProfile = JSON.parse(stored);
      if (parsed?.phoneNumber) {
        setUser(parsed);
      }
    } catch (error) {
      console.error("Failed to restore user session", error);
    }
  }, []);

  const requestOtp = useCallback(async (phoneNumber: string) => {
    const trimmed = phoneNumber.trim();
    if (!isValidPhone(trimmed)) {
      throw new Error("Enter a valid 10-digit mobile number.");
    }

    const formattedPhone = trimmed.startsWith('+91') ? trimmed : `+91${trimmed}`;
    const result = await sendOTP(formattedPhone);

    if (!result.success) {
      throw new Error(result.message);
    }

    toast.success("OTP sent successfully.", {
      description: result.message,
    });
  }, []);

  const verifyOtp = useCallback(
    async (phoneNumber: string, otp: string) => {
      const trimmedPhone = phoneNumber.trim();

      if (!/^[0-9]{6}$/.test(otp.trim())) {
        throw new Error("Enter the 6-digit OTP sent to you.");
      }

      const formattedPhone = trimmedPhone.startsWith('+91') ? trimmedPhone : `+91${trimmedPhone}`;
      const result = await verifyOTP(formattedPhone, otp.trim());

      if (!result.success || !result.userId) {
        throw new Error(result.message);
      }

      const profile: UserProfile = {
        id: result.userId,
        phoneNumber: formattedPhone,
        lastLoginAt: new Date().toISOString(),
      };

      setUser(profile);
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(profile));

      toast.success("Login successful.", {
        description: "You are now securely logged in.",
      });
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_AUTH_STORAGE_KEY);
    toast.info("You have been logged out.");
  }, []);

  const value = useMemo<UserAuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      requestOtp,
      verifyOtp,
      logout,
    }),
    [logout, requestOtp, user, verifyOtp],
  );

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
};

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error("useUserAuth must be used within a UserAuthProvider");
  }
  return context;
};
