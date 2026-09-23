import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  handleDuplicateUtrAttempt,
  isUtrDuplicate,
  validateUtrFormat,
} from '@/lib/checkDuplicateUtr';
import { createInvoice } from '@/lib/invoiceGenerator';
import { supabase } from '@/lib/supabase';

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [batch, setBatch] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [validUntilDate, setValidUntilDate] = useState<string | null>(null);
  const [restrictionReason, setRestrictionReason] = useState<string | null>(null);
  const [hasNexus, setHasNexus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBuyFlow, setShowBuyFlow] = useState(false);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyPending, setAlreadyPending] = useState(false);
  const [myMobile, setMyMobile] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [finalAmount, setFinalAmount] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [existingRating, setExistingRating] = useState<any>(null);

  const [myCoins, setMyCoins] = useState(0);
  const [hasTrialAvailable, setHasTrialAvailable] = useState(false);
  const [onWaitlist, setOnWaitlist] = useState(false);

  async function load() {
    try {
      const { data: batchData } = await supabase.from('batches').select('*').eq('id', id).single();
      setBatch(batchData);
      if (batchData) setFinalAmount(batchData.price ?? 0);

      const { data: qrData } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('batch_id', id)
        .eq('is_active', true)
        .order('order_index');
      setQrCodes(qrData ?? []);

      const { data: subs } = await supabase
        .from('subjects')
        .select('*')
        .eq('batch_id', id)
        .order('order_index');
      setSubjects(subs ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Fetch approved payment with validity check
        const { data: approvedPayment } = await supabase
          .from('payments')
          .select('id, valid_until, submitted_at')
          .eq('student_id', user.id)
          .eq('batch_id', id)
          .eq('status', 'approved')
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (approvedPayment) {
          let expired = false;
          if (approvedPayment.valid_until) {
            expired = new Date(approvedPayment.valid_until).getTime() < Date.now();
            setValidUntilDate(approvedPayment.valid_until);
          }
          setIsExpired(expired);
          setHasAccess(!expired);
        } else {
          setHasAccess(false);
          setIsExpired(false);
        }

        const { data: restriction } = await supabase
          .from('batch_restrictions')
          .select('reason')
          .eq('student_id', user.id)
          .eq('batch_id', id)
          .maybeSingle();
        setRestrictionReason(restriction?.reason ?? null);

        const { data: pendingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('student_id', user.id)
          .eq('batch_id', id)
          .eq('status', 'pending')
          .maybeSingle();
        setAlreadyPending(!!pendingPayment);

        const { data: activeNexus } = await supabase
          .from('nexus_passes')
          .select('end_date')
          .eq('student_id', user.id)
          .eq('status', 'approved')
          .maybeSingle();
        const hasActiveNexus =
          activeNexus && (!activeNexus.end_date || new Date(activeNexus.end_date) > new Date());
        if (hasActiveNexus) {
          setHasAccess(true);
          setIsExpired(false);
        }
        setHasNexus(!!hasActiveNexus);

        const { data: profile } = await supabase
          .from('profiles')
          .select('coins, referred_by, trial_claimed, created_at, mobile')
          .eq('id', user.id)
          .single();
        setMyCoins(profile?.coins ?? 0);
        setMyMobile(profile?.mobile ?? null);

        if (profile?.referred_by && !profile?.trial_claimed) {
          const signupTime = new Date(profile.created_at).getTime();
          setHasTrialAvailable(Date.now() - signupTime < 2 * 24 * 60 * 60 * 1000);
        }

        const { data: wait } = await supabase
          .from('waitlist')
          .select('id')
          .eq('student_id', user.id)
          .eq('batch_id', id)
          .maybeSingle();
        setOnWaitlist(!!wait);

        const { data: myRatingData } = await supabase
          .from('ratings')
          .select('*')
          .eq('student_id', user.id)
          .eq('batch_id', id)
          .maybeSingle();
        setExistingRating(myRatingData);
      }
    } catch (err) {
      console.error('Batch load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function getCurrentQr() {
    if (qrCodes.length === 0) return null;
    const rotationIndex = Math.floor(Date.now() / (2 * 60 * 1000)) % qrCodes.length;
    return qrCodes[rotationIndex];
  }

  async function applyCoupon() {
    if (!batch || !couponCode.trim()) return;
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (!coupon) {
      Alert.alert('Invalid coupon', 'This coupon code is not valid.');
      return;
    }
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      Alert.alert('Expired', 'This coupon has expired.');
      return;
    }
    if (coupon.batch_id && coupon.batch_id !== id) {
      Alert.alert('Not applicable', 'This coupon is not valid for this batch.');
      return;
    }

    const basePrice = batch.price ?? 0;
    let discounted = basePrice;
    if (coupon.discount_type === 'percentage') {
      discounted = basePrice - (basePrice * coupon.discount_value) / 100;
    } else {
      discounted = Math.max(0, basePrice - coupon.discount_value);
    }

    setAppliedCoupon(coupon);
    setFinalAmount(discounted);
    Alert.alert('Coupon applied!', `New price: ₹${discounted}`);
  }

  async function submitPayment() {
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      return;
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('full_name, mobile')
      .eq('id', user.id)
      .single();

    const studentName = myProfile?.full_name || 'Student';
    const daysToAdd = batch?.validity_days || 365;
    const expiryTimestamp = new Date(Date.now() + daysToAdd * 86400000).toISOString();

    // 1. FREE COUPON UNLOCK CASE
    if (finalAmount <= 0) {
      const { error } = await supabase.from('payments').insert({
        student_id: user.id,
        batch_id: id,
        utr: appliedCoupon ? `COUPON-${couponCode.trim().toUpperCase()}` : 'COUPON-FREE',
        amount: 0,
        status: 'approved',
        valid_from: new Date().toISOString(),
        valid_until: expiryTimestamp,
        reviewed_at: new Date().toISOString(),
      });

      if (!error) {
        await supabase.rpc('increment_enrolled_count', { p_batch_id: id });
        if (appliedCoupon) {
          await supabase
            .from('coupon_usage')
            .insert({ coupon_id: appliedCoupon.id, student_id: user.id });
        }

        await createInvoice({
          studentId: user.id,
          batchId: id as string,
          amount: 0,
          productType: 'batch',
          mobile: myMobile,
        });

        await supabase.rpc('reward_referral', { p_buyer_id: user.id, p_reward_coins: 100 });

        Alert.alert('Unlocked!', 'Batch unlocked successfully! Invoice has been generated.');
        setShowBuyFlow(false);
        setHasAccess(true);
        setIsExpired(false);
        load();
      } else {
        Alert.alert('Error', error.message);
      }
      setSubmitting(false);
      return;
    }

    // 2. PAID CASE: STRICT UTR VALIDATION (Letters & fake numbers block)
    const cleanUtr = utr.trim();
    const validation = validateUtrFormat(cleanUtr);
    if (!validation.isValid) {
      Alert.alert('Invalid UTR', validation.error);
      setSubmitting(false);
      return;
    }

    // 3. DUPLICATE CHECK & FRAUD RECORDING
    const isDuplicate = await isUtrDuplicate(cleanUtr);
    if (isDuplicate) {
      const result = await handleDuplicateUtrAttempt(user.id, studentName);
      setSubmitting(false);

      if (result.locked) {
        Alert.alert(
          'Account Locked',
          'Aapne baar-baar duplicate/fake UTR daalne ki koshish ki hai. Suraksha ke kaaran aapka account admin review ke liye lock kar diya gaya hai.'
        );
        await supabase.auth.signOut();
      } else {
        Alert.alert(
          'Duplicate UTR Warning',
          'Yeh UTR pehle hi use ho chuka hai. Kripya apna payment app check karke asli 12-digit UPI UTR dalein. Doosri baar galat daalne par account lock ho jayega.'
        );
      }
      return;
    }

    // 4. VALID SUBMISSION
    const currentQr = getCurrentQr();
    const { error } = await supabase.from('payments').insert({
      student_id: user.id,
      batch_id: id,
      utr: cleanUtr,
      amount: finalAmount,
      qr_reference_id: currentQr?.id ?? null,
      status: 'pending',
      valid_until: expiryTimestamp,
    });

    if (!error && appliedCoupon) {
      await supabase
        .from('coupon_usage')
        .insert({ coupon_id: appliedCoupon.id, student_id: user.id });
    }

    setSubmitting(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Submitted!', 'Payment request submit ho gayi hai. Admin review ke baad batch unlock ho jayega.');
    setShowBuyFlow(false);
    setUtr('');
    setAlreadyPending(true);
  }

  async function claimFreeTrial() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const twoDaysExpiry = new Date(Date.now() + 2 * 86400000).toISOString();
    const { error } = await supabase.from('payments').insert({
      student_id: user.id,
      batch_id: id,
      utr: 'REFERRAL-TRIAL',
      amount: 0,
      status: 'approved',
      valid_until: twoDaysExpiry,
      reviewed_at: new Date().toISOString(),
    });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.from('profiles').update({ trial_claimed: true }).eq('id', user.id);
    Alert.alert('Trial activated!', 'Aapko is batch ka 2 din ka free access mil gaya hai.');
    load();
  }

  async function redeemWithCoins() {
    const cost = batch?.price ?? 0;
    if (myCoins < cost) {
      Alert.alert('Not enough coins', `Aapko ${cost} coins chahiye, aapke paas ${myCoins} hain.`);
      return;
    }
    Alert.alert(
      'Redeem with coins',
      `Kya aap ${cost} coins use karke is batch ko unlock karna chahte hain?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock Now',
          onPress: async () => {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { error: coinErr } = await supabase
              .from('profiles')
              .update({ coins: myCoins - cost })
              .eq('id', user.id);

            if (coinErr) {
              Alert.alert('Error', coinErr.message);
              return;
            }

            await supabase.from('coin_transactions').insert({
              student_id: user.id,
              amount: -cost,
              reason: `Unlocked batch: ${batch?.name || 'Course'}`,
            });

            const daysToAdd = batch?.validity_days || 365;
            const expiryTimestamp = new Date(Date.now() + daysToAdd * 86400000).toISOString();

            const { error: payErr } = await supabase.from('payments').insert({
              student_id: user.id,
              batch_id: id,
              utr: `COINS-${Date.now()}`,
              amount: cost,
              status: 'approved',
              valid_from: new Date().toISOString(),
              valid_until: expiryTimestamp,
              reviewed_at: new Date().toISOString(),
            });

            if (payErr) {
              Alert.alert('Error', payErr.message);
              return;
            }

            await supabase.rpc('increment_enrolled_count', { p_batch_id: id });

            await createInvoice({
              studentId: user.id,
              batchId: id as string,
              amount: cost,
              productType: 'batch',
              mobile: myMobile,
            });

            await supabase.rpc('reward_referral', { p_buyer_id: user.id, p_reward_coins: 100 });

            Alert.alert('Unlocked!', 'Batch coins se unlock ho gaya aur invoice generate ho gayi!');
            load();
          },
        },
      ]
    );
  }

  async function joinWaitlist() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('waitlist').insert({ student_id: user?.id, batch_id: id });
    if (error && !error.message.includes('duplicate')) {
      Alert.alert('Error', error.message);
      return;
    }
    setOnWaitlist(true);
    Alert.alert('Added to waitlist', 'Seat khali hone par aapko notify kiya jayega.');
  }

  async function submitRating() {
    if (myRating === 0) {
      Alert.alert('Select a rating', 'Star rating select karein.');
      return;
    }
    if (!reviewText.trim()) {
      Alert.alert('Reason required', 'Review likhna zaroori hai.');
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ratings')
      .insert({ student_id: user?.id, batch_id: id, rating: myRating, review: reviewText });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Thanks!', 'Aapka rating submit ho gaya.');
      setExistingRating({ rating: myRating, review: reviewText });
    }
  }

  if (loading || !batch) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const currentQr = getCurrentQr();
  const batchPrice = batch.price ?? 0;
  const isFull = batch.capacity && (batch.enrolled_count ?? 0) >= batch.capacity && !hasNexus;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: batch.name ?? 'Batch Details',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {restrictionReason && (
          <View style={{ backgroundColor: '#3A2020', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <Text style={{ color: '#FF6B6B', fontWeight: '700', fontSize: 13 }}>🔒 Access Restricted</Text>
            <Text style={{ color: '#FF9B9B', fontSize: 12, marginTop: 4 }}>{restrictionReason}</Text>
          </View>
        )}

        {batch.cover_image_url ? (
          <Image source={{ uri: batch.cover_image_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}

        <Text style={styles.name}>{batch.name}</Text>
        <Text style={styles.desc}>{batch.description}</Text>
        <Text style={styles.price}>₹{batchPrice}</Text>
        <Text style={styles.validityBadge}>
          Validity: {batch.validity_text || `${batch.validity_days || 365} Days`}
        </Text>

        {/* Lock Screen when Validity is Expired */}
        {isExpired && !hasNexus && (
          <View style={styles.expiredCard}>
            <Ionicons name="lock-closed" size={30} color="#FF6B6B" />
            <Text style={styles.expiredTitle}>Course Validity Expired</Text>
            <Text style={styles.expiredDesc}>
              Aapka access {validUntilDate ? new Date(validUntilDate).toLocaleDateString() : ''} ko expire ho chuka hai. Course dubara dekhne ke liye access renew karein.
            </Text>
            <Pressable style={styles.renewBtn} onPress={() => setShowBuyFlow(true)}>
              <Text style={styles.renewBtnText}>Renew Batch Access</Text>
            </Pressable>
          </View>
        )}

        {restrictionReason ? null : hasAccess ? (
          <View style={styles.accessBox}>
            <Text style={styles.accessText}>✓ You have active access to this batch</Text>
            {validUntilDate && (
              <Text style={styles.validSub}>
                Valid Until: {new Date(validUntilDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        ) : alreadyPending ? (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingText}>Aapka payment admin approval ke liye pending hai.</Text>
          </View>
        ) : !isExpired ? (
          <View style={{ gap: 10 }}>
            {hasTrialAvailable && (
              <Pressable style={styles.trialButton} onPress={claimFreeTrial}>
                <Text style={styles.buyButtonText}>🎁 Claim 2-Day Free Trial</Text>
              </Pressable>
            )}

            {isFull ? (
              <View>
                <Text style={styles.fullText}>This batch is full.</Text>
                <Text style={styles.fullSubtext}>Get Nexus Pass for instant access, or join the waitlist.</Text>
                {!onWaitlist ? (
                  <Pressable style={styles.waitlistButton} onPress={joinWaitlist}>
                    <Text style={styles.buyButtonText}>Notify Me</Text>
                  </Pressable>
                ) : (
                  <View style={styles.pendingBox}>
                    <Text style={styles.pendingText}>Aap waitlist mein hain.</Text>
                  </View>
                )}
              </View>
            ) : !showBuyFlow ? (
              <Pressable style={styles.buyButton} onPress={() => setShowBuyFlow(true)}>
                <Text style={styles.buyButtonText}>Buy Now</Text>
              </Pressable>
            ) : null}

            {myCoins >= batchPrice && batchPrice > 0 && (
              <Pressable style={styles.coinButton} onPress={redeemWithCoins}>
                <Text style={styles.buyButtonText}>🪙 Unlock with {batchPrice} Coins</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {showBuyFlow && !hasAccess && !alreadyPending && !isFull && (
          <View style={styles.buyFlow}>
            {finalAmount > 0 ? (
              <>
                {currentQr ? (
                  <>
                    <Text style={styles.qrLabel}>Scan this QR to pay ₹{finalAmount}</Text>
                    <Image source={{ uri: currentQr.image_url }} style={styles.qrImage} />
                  </>
                ) : (
                  <Text style={styles.qrLabel}>No payment QR set up yet. Contact admin.</Text>
                )}
              </>
            ) : (
              <Text style={styles.qrLabel}>🎉 Free with your coupon! No payment needed.</Text>
            )}

            <View style={styles.couponRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Coupon code (optional)"
                placeholderTextColor="#8A8FA3"
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
              <Pressable style={styles.applyBtn} onPress={applyCoupon}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </Pressable>
            </View>
            <Text style={styles.finalAmountText}>Amount to pay: ₹{finalAmount}</Text>

            {finalAmount > 0 && (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 12-digit UPI UTR (e.g. 426182940192)"
                  placeholderTextColor="#8A8FA3"
                  value={utr}
                  // Auto-filter: Only allow digits 0-9 and max 12 characters
                  onChangeText={(text) => setUtr(text.replace(/[^0-9]/g, '').slice(0, 12))}
                  keyboardType="numeric"
                  maxLength={12}
                />
                <Text style={styles.helperText}>
                  Payment app (PhonePe/GPay/Paytm) se 12-digit UTR / UPI Ref number dalein.
                </Text>
              </View>
            )}
            <Pressable style={styles.submitButton} onPress={submitPayment} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#0A0E1A" />
              ) : (
                <Text style={styles.buyButtonText}>
                  {finalAmount > 0 ? 'Submit Payment' : 'Unlock Now'}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {hasAccess && (
          <Pressable style={styles.libraryLink} onPress={() => router.push(`/library/${id}` as any)}>
            <Text style={styles.libraryLinkText}>📚 View Library / Notes</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Subjects</Text>
        {subjects.length === 0 && <Text style={styles.emptyText}>No content added yet.</Text>}
        {subjects.map((subject) => (
          <Pressable
            key={subject.id}
            style={[styles.subjectCard, !hasAccess && styles.subjectCardLocked]}
            onPress={() => {
              if (!hasAccess) {
                Alert.alert('Batch Locked', 'Subjects dekhne ke liye is batch ko unlock ya renew karein.');
                return;
              }
              router.push(
                `/batch/${id}/subject/${subject.id}?batchName=${batch.name}&subjectName=${subject.name}` as any
              );
            }}
          >
            <Ionicons
              name={hasAccess ? 'book' : 'lock-closed'}
              size={20}
              color={hasAccess ? '#D4AF37' : '#8A8FA3'}
            />
            <Text style={[styles.subjectName, !hasAccess && { color: '#8A8FA3' }]}>{subject.name}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
        ))}

        {hasAccess && (
          <View style={styles.ratingSection}>
            <Text style={styles.sectionTitle}>{existingRating ? 'Your Rating' : 'Rate this batch'}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} disabled={!!existingRating} onPress={() => setMyRating(star)}>
                  <Ionicons
                    name={star <= (existingRating?.rating ?? myRating) ? 'star' : 'star-outline'}
                    size={28}
                    color="#D4AF37"
                  />
                </Pressable>
              ))}
            </View>

            {existingRating ? (
              <Text style={styles.existingReview}>{existingRating.review || 'No written review.'}</Text>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={myRating > 0 ? `Why ${myRating} stars? (required)` : 'Select a star first'}
                  placeholderTextColor="#8A8FA3"
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                  editable={myRating > 0}
                />
                <Pressable style={styles.submitButton} onPress={submitRating}>
                  <Text style={styles.buyButtonText}>Submit Rating</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 12 },
  cover: { width: '100%', height: 180, borderRadius: 14 },
  coverPlaceholder: { backgroundColor: '#151A2C' },
  name: { color: 'white', fontSize: 22, fontWeight: '700' },
  desc: { color: '#8A8FA3', fontSize: 14 },
  price: { color: '#D4AF37', fontSize: 20, fontWeight: '700' },
  validityBadge: { color: '#60A5FA', fontSize: 13, fontWeight: '600' },
  accessBox: { backgroundColor: '#152A1E', borderRadius: 12, padding: 14, marginTop: 8, alignItems: 'center' },
  accessText: { color: '#4ADE80', textAlign: 'center', fontWeight: '700' },
  validSub: { color: '#86EFAC', fontSize: 12, marginTop: 4 },
  expiredCard: {
    backgroundColor: '#3A1515',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  expiredTitle: { color: '#EF4444', fontWeight: '800', fontSize: 16 },
  expiredDesc: { color: '#FCA5A5', textAlign: 'center', fontSize: 12 },
  renewBtn: { backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, marginTop: 4 },
  renewBtnText: { color: '#0A0E1A', fontWeight: '800', fontSize: 13 },
  buyButton: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buyButtonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
  pendingBox: { backgroundColor: '#1A2036', borderRadius: 12, padding: 16, marginTop: 8 },
  pendingText: { color: '#D4AF37', textAlign: 'center' },
  buyFlow: { gap: 12, marginTop: 8 },
  qrLabel: { color: 'white', fontSize: 14, textAlign: 'center' },
  qrImage: { width: 220, height: 220, alignSelf: 'center', borderRadius: 12 },
  input: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: 'white',
    fontSize: 16,
  },
  helperText: { color: '#8A8FA3', fontSize: 11, marginTop: 4, marginLeft: 4 },
  applyBtn: { backgroundColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  applyBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  submitButton: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  sectionTitle: { color: 'white', fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyText: { color: '#8A8FA3', fontSize: 13 },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 14,
  },
  subjectCardLocked: { opacity: 0.7 },
  subjectName: { color: 'white', fontSize: 15, fontWeight: '600', flex: 1 },
  couponRow: { flexDirection: 'row', gap: 8 },
  finalAmountText: { color: '#D4AF37', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  ratingSection: { gap: 10, marginTop: 20 },
  starsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  textArea: { height: 70, textAlignVertical: 'top' },
  existingReview: { color: '#B8C0D8', fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  trialButton: { backgroundColor: '#3C9FFE', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  coinButton: { backgroundColor: '#B8912C', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  waitlistButton: { backgroundColor: '#2A3150', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  fullText: { color: '#FF6B6B', fontWeight: '700', fontSize: 15 },
  fullSubtext: { color: '#8A8FA3', fontSize: 12, marginTop: 2, marginBottom: 8 },
  libraryLink: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  libraryLinkText: { color: '#D4AF37', fontWeight: '600' },
});