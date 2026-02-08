import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useState } from "react";
import { nanoid } from "nanoid";

// Hook for fetching user data (simulation debug view)
export function useUser(phoneNumber: string) {
  return useQuery({
    queryKey: [api.users.get.path, phoneNumber],
    queryFn: async () => {
      const url = buildUrl(api.users.get.path, { phoneNumber });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.users.get.responses[200].parse(await res.json());
    },
    // Poll frequently to show updates in simulation
    refetchInterval: 2000,
  });
}

// Hook for sending USSD requests
export function useUSSD() {
  const queryClient = useQueryClient();
  // We manage sessionId locally for the session lifecycle
  const [sessionId, setSessionId] = useState<string>("");

  const startSession = () => {
    const newId = nanoid();
    setSessionId(newId);
    return newId;
  };

  const endSession = () => {
    setSessionId("");
  };

  const mutation = useMutation({
    mutationFn: async ({
      phoneNumber,
      text,
      currentSessionId,
      ussdCode,
    }: {
      phoneNumber: string;
      text: string;
      currentSessionId: string;
      ussdCode?: string;
    }) => {
      const res = await fetch(api.ussd.simulator.path, {
        method: api.ussd.simulator.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          text,
          sessionId: currentSessionId,
          ussdCode,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        let errorMessage = "USSD Request Failed";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          if (res.status === 401) {
            errorMessage = "Authentication required. Please log in.";
          }
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return api.ussd.simulator.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Invalidate user query to refresh balance if changed
      queryClient.invalidateQueries({ queryKey: [api.users.get.path] });
    },
  });

  return {
    send: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    startSession,
    endSession,
    sessionId,
  };
}
