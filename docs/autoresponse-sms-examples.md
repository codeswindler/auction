# Onfon Autoresponse SMS Examples for LiveAuction

## 1. Bid Fee Payment Success (Randomized - Keeps Bidders on Their Toes)

### Option A (Urgency & Competition)
```
Bid fee Ksh 50 received! Ref: PAI8F
Your bid is LIVE! Others are bidding too...
Stay sharp! Dial *855*22#
```

### Option B (Excitement & Heat)
```
Bid fee confirmed! Ksh 50 | Ref: PAI8F
You're in the game! Competition is heating up.
Dial *855*22# to stay ahead!
```

### Option C (Intensity & Action)
```
Bid active! Ksh 50 | Ref: PAI8F
The action is intense! Don't miss out.
Dial *855*22# now!
```

### Option D (Competitive Edge)
```
Bid fee received! Ksh 50 | Ref: PAI8F
You're competing! Others are watching.
Dial *855*22# to keep bidding!
```

### Option E (Motivation)
```
Bid confirmed! Ksh 50 | Ref: PAI8F
You're in the race! Every bid counts.
Dial *855*22# to continue!
```

---

## 2. Bid Fee Payment Failed

### Option A (Urgent Retry)
```
Payment of Ksh 50 failed.
Don't miss out! Dial *855*22# to retry now.
```

### Option B (Competitive Push)
```
Payment failed! Ksh 50
Others are bidding! Retry quickly.
Dial *855*22# to get back in!
```

---

## 3. Bid Placed Confirmation (After Fee Payment - Randomized)

### Option A (Fierce Competition)
```
Bid PAI8F of Ksh 10 placed!
The competition is fierce! Keep bidding.
Dial *855*22#
```

### Option B (Active & Competitive)
```
Your bid PAI8F (Ksh 10) is active!
Others are bidding too. Stay competitive!
Dial *855*22#
```

### Option C (Game On)
```
Bid PAI8F confirmed! Ksh 10
You're in the game! Don't stop now.
Dial *855*22# to bid again!
```

---

## 4. General Payment Success (Deposit/Other)

### Option A (Simple)
```
Payment of Ksh 100 received! Ref: PAI8F
Thank you for using LiveAuction!
Dial *855*22#
```

---

## 5. Payment Cancelled by User

```
Payment cancelled. No charges made.
Get back in the game! Dial *855*22# to try again.
```

---

## Implementation Notes:

**System randomly selects from message variations** to keep bidders engaged and create urgency.

**Key Elements:**
- GSM-7 compatible (no emojis, standard ASCII characters only)
- Create urgency ("Others are bidding", "Competition is heating up")
- Keep it short and punchy
- Always include USSD code (*855*22#)
- Include bid reference (PAI8F format)
- No helpline numbers
- No winners mentioned (bid fee collection only)
- Correct spelling: "paid" (not "payed")

**Message Rotation:** The system randomly picks from 5 different bid fee messages to keep responses fresh and engaging.
