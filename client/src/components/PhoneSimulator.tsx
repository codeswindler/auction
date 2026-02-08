import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Delete, Send, Hash, CornerDownLeft, Signal, Wifi, Battery } from "lucide-react";
import { useUSSD } from "@/hooks/use-ussd";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PhoneSimulatorProps {
  phoneNumber: string;
}

export function PhoneSimulator({ phoneNumber }: PhoneSimulatorProps) {
  const [screen, setScreen] = useState<"dialer" | "ussd">("dialer");
  const normalizeUssdCode = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "*123#";
    if (trimmed.startsWith("*") && trimmed.endsWith("#")) return trimmed;
    return `*${trimmed.replace(/^[*#]+|[*#]+$/g, "")}#`;
  };

  const [dialInput, setDialInput] = useState(() => {
    const envCode = import.meta.env.VITE_SIMULATOR_USSD_CODE;
    return normalizeUssdCode(envCode || "*123#");
  });
  const [ussdResponse, setUssdResponse] = useState("");
  const [ussdInput, setUssdInput] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [accumulatedInput, setAccumulatedInput] = useState(""); // Track full USSD path
  const [sessionUssdCode, setSessionUssdCode] = useState("");
  const { send, startSession, endSession, isLoading, sessionId } = useUSSD();
  const { toast } = useToast();
  const ussdInputRef = useRef<HTMLInputElement>(null);

  const handleDigitPress = (digit: string) => {
    if (screen === "dialer") {
      if (dialInput.length < 15) setDialInput((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setDialInput((prev) => prev.slice(0, -1));
  };

  const handleCall = async () => {
    const normalizedInput = normalizeUssdCode(dialInput);
    if (normalizedInput !== dialInput) {
      setDialInput(normalizedInput);
    }

    setScreen("ussd");
    const newSessionId = startSession();
    setIsSessionActive(true);
    setUssdResponse("Loading...");
    
    // Remove the trailing # for accumulation
    const codeWithoutHash = normalizedInput.replace(/#$/, "");
    setAccumulatedInput(codeWithoutHash);
    setSessionUssdCode(normalizedInput);

    try {
      const response = await send({
        phoneNumber,
        text: normalizedInput,
        currentSessionId: newSessionId,
        ussdCode: normalizedInput,
      });

      setUssdResponse(response.message);
      if (response.type === "END") {
        setIsSessionActive(false);
        setTimeout(() => {
          setScreen("dialer");
          endSession();
          setUssdResponse("");
          setAccumulatedInput("");
        }, 3000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection Error or Invalid MMI Code.";
      setUssdResponse(message);
      setIsSessionActive(false);
      setTimeout(() => {
        setScreen("dialer");
        endSession();
        setUssdResponse("");
        setAccumulatedInput("");
      }, 2000);
    }
  };

  const handleUSSDReply = async () => {
    if (!ussdInput) return;

    const currentInput = ussdInput;
    setUssdInput("");
    setUssdResponse("Sending...");
    
    // Build full USSD path: accumulated + * + current input
    const fullUSSDPath = accumulatedInput + "*" + currentInput + "#";
    
    // Update accumulated input for next call (remove trailing #)
    setAccumulatedInput(fullUSSDPath.replace(/#$/, ""));

    try {
      const response = await send({
        phoneNumber,
        text: fullUSSDPath,
        currentSessionId: sessionId,
        ussdCode: sessionUssdCode || dialInput,
      });

      setUssdResponse(response.message);

      if (response.type === "END") {
        setIsSessionActive(false);
        // Check for specific success messages to simulate STK push
        if (response.message.includes("STK Push")) {
             toast({
              title: "📱 STK Push Received",
              description: "Please enter your MPESA PIN to complete the transaction.",
              duration: 5000,
              className: "bg-emerald-50 border-emerald-200 text-emerald-900",
            });
        }
        
        setTimeout(() => {
          setScreen("dialer");
          endSession();
          setUssdResponse("");
          setAccumulatedInput("");
        }, 4000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network Error";
      setUssdResponse(errorMessage);
      setIsSessionActive(false);
      
      // Show toast for authentication errors
      if (errorMessage.includes("Authentication") || errorMessage.includes("Unauthorized")) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use the simulator.",
          variant: "destructive",
          duration: 5000,
        });
      }
      
      setTimeout(() => {
        setScreen("dialer");
        endSession();
        setUssdResponse("");
        setAccumulatedInput("");
      }, 2000);
    }
  };

  const handleCancel = () => {
    setScreen("dialer");
    setIsSessionActive(false);
    endSession();
    setUssdResponse("");
    setUssdInput("");
    setAccumulatedInput("");
    setSessionUssdCode("");
  };

  // Auto-focus input when USSD screen appears
  useEffect(() => {
    if (screen === "ussd" && isSessionActive && !isLoading) {
      setTimeout(() => ussdInputRef.current?.focus(), 100);
    }
  }, [screen, isSessionActive, isLoading, ussdResponse]);

  return (
    <div className="relative w-[320px] h-[650px] bg-black rounded-[3rem] phone-screen-shadow border-[8px] border-zinc-800 overflow-hidden flex flex-col">
      {/* Status Bar */}
      <div className="h-8 bg-black text-white px-6 flex items-center justify-between text-xs font-medium z-20">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <Battery className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Screen Content */}
      <div className="flex-1 relative bg-white overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === "dialer" ? (
            <motion.div
              key="dialer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col bg-white"
            >
              {/* Dial Display */}
              <div className="flex-1 flex flex-col justify-end pb-8 px-6">
                <input
                  type="text"
                  readOnly
                  value={dialInput}
                  className="w-full text-center text-4xl font-light text-zinc-900 bg-transparent outline-none mb-2"
                  placeholder=""
                />
                <div className="text-center text-sm text-primary font-medium h-5">
                  {dialInput ? "Add to Contacts" : ""}
                </div>
              </div>

              {/* Keypad */}
              <div className="pb-12 px-6">
                <div className="grid grid-cols-3 gap-x-4 gap-y-6 mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => handleDigitPress(digit.toString())}
                      className="w-16 h-16 rounded-full bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 flex flex-col items-center justify-center transition-colors mx-auto"
                    >
                      <span className="text-2xl font-medium text-zinc-900">{digit}</span>
                      <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase">
                        {["", "", "ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ"][digit]}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => handleDigitPress("*")}
                    className="w-16 h-16 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors mx-auto"
                  >
                    <span className="text-3xl text-zinc-600 pt-2">*</span>
                  </button>
                  <button
                    onClick={() => handleDigitPress("0")}
                    className="w-16 h-16 rounded-full bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 flex flex-col items-center justify-center transition-colors mx-auto"
                  >
                    <span className="text-2xl font-medium text-zinc-900">0</span>
                    <span className="text-[10px] font-bold text-zinc-400">+</span>
                  </button>
                  <button
                    onClick={() => handleDigitPress("#")}
                    className="w-16 h-16 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors mx-auto"
                  >
                    <Hash className="w-6 h-6 text-zinc-600" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="w-16 mx-auto"></div> {/* Spacer */}
                  <button
                    onClick={handleCall}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 flex items-center justify-center text-white transition-all shadow-lg shadow-green-200 mx-auto transform active:scale-95"
                  >
                    <Phone className="w-7 h-7 fill-current" />
                  </button>
                  <div className="w-16 mx-auto flex justify-center">
                    {dialInput && (
                      <button
                        onClick={handleDelete}
                        className="w-16 h-16 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        <Delete className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="ussd"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <div className="w-full bg-white/95 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-5 border-b border-zinc-100">
                  <div className="flex flex-col gap-3 min-h-[120px]">
                    {isLoading ? (
                      <div className="flex items-center justify-center flex-1">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-800">
                        {ussdResponse}
                      </p>
                    )}
                  </div>
                </div>
                
                {isSessionActive && (
                  <div className="p-4 bg-zinc-50">
                    <div className="flex gap-2 mb-3">
                      <input
                        ref={ussdInputRef}
                        type="text"
                        value={ussdInput}
                        onChange={(e) => setUssdInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUSSDReply()}
                        className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={handleCancel}
                        className="text-sm font-medium text-zinc-500 hover:text-zinc-800 px-3 py-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUSSDReply}
                        disabled={isLoading || !ussdInput}
                        className="text-sm font-medium text-primary hover:text-primary/80 px-4 py-1.5 transition-colors disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
                
                {!isSessionActive && !isLoading && (
                  <div className="p-4 bg-zinc-50 flex justify-center">
                    <button
                      onClick={handleCancel}
                      className="w-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Home Indicator */}
      <div className="h-5 bg-white flex justify-center items-end pb-2">
        <div className="w-32 h-1 bg-zinc-300 rounded-full"></div>
      </div>
    </div>
  );
}
