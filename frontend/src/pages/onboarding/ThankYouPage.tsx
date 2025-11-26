import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import './ResearchConsentPage.css';

const ThankYouPage = () => {
  const navigate = useNavigate();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleGoHome = () => {
    navigate('/');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 11) {
      setPhoneNumber(value);
    }
  };

  // 건의사항 입력 핸들러 (300자 제한)
  const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 300) {
      setFeedback(value);
    }
  };

  // 건의사항만 별도로 전송하는 핸들러
  const handleSubmitFeedbackOnly = async () => {
    if (!feedback.trim()) {
      alert('건의사항 내용을 입력해주세요.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      const gifticonDocRef = doc(db, 'users', user.uid, 'gifticon', 'entry');

      await setDoc(gifticonDocRef, {
        feedback: feedback,
        feedbackSubmittedAt: serverTimestamp(),
      }, { merge: true });

      alert('소중한 의견 감사합니다! 건의사항이 성공적으로 전달되었습니다.');
      setFeedback(''); 
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitContact = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('올바른 전화번호를 입력해주세요.');
      return;
    }
    if (!isAgreed) {
      alert('개인정보 수집 및 이용에 동의해야 합니다.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const gifticonDocRef = doc(db, 'users', user.uid, 'gifticon', 'entry');

      await setDoc(gifticonDocRef, {
        phoneNumber: phoneNumber,
        feedback: feedback,
        agreedToCollection: true,
        submittedAt: serverTimestamp(),
      }, { merge: true });

      setIsSubmitted(true);
      alert('소중한 의견과 함께 응모가 완료되었습니다! 감사합니다.');
    } catch (error) {
      console.error('Failed to submit contact info:', error);
      alert('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="research-consent-page">
      <div className="research-consent-card" style={{ textAlign: 'center' }}>
        <p className="eyebrow">Research Complete</p>
        <h1>참여해 주셔서 감사합니다</h1>
        <p className="lead">
          귀하의 데이터 수집이 성공적으로 완료되었습니다.<br />
          FPS 에이밍 분석 연구에 큰 도움을 주셔서 진심으로 감사드립니다.
        </p>

        <section className="research-overview" style={{ margin: '40px 0', padding: '30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🎁</div>
          <h2>기프티콘 추첨 안내</h2>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '20px' }}>
            연구에 참여해 주신 분들 중<br />
            <b>10명을 추첨하여 소정의 기프티콘 (스타벅스 아이스 카페 아메리카노T) </b>을 보내드립니다.
          </p>

          {!isSubmitted ? (
            <div className="contact-form" style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              padding: '20px', 
              borderRadius: '12px',
              textAlign: 'left',
              marginTop: '20px'
            }}>
              {/* 건의사항 입력 영역 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <label 
                    htmlFor="feedback" 
                    style={{ fontWeight: 'bold', fontSize: '0.9rem' }}
                  >
                    궁금한 점이나 건의사항 (선택)
                  </label>
                  {/* 글자 수 카운터 */}
                  <span style={{ fontSize: '0.8rem', color: feedback.length === 300 ? '#ff6b6b' : '#aaa' }}>
                    {feedback.length} / 300
                  </span>
                </div>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={handleFeedbackChange}
                  maxLength={300} // 최대 글자 수 제한
                  placeholder="실험을 진행하면서 궁금했던 점이나 개선할 점이 있다면 자유롭게 적어주세요. (최대 300자)"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    backgroundColor: '#fff',
                    color: '#333',
                    fontSize: '1rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSubmitFeedbackOnly}
                    disabled={isSubmitting || !feedback.trim()}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      borderRadius: '4px',
                      border: '1px solid #666',
                      backgroundColor: 'transparent',
                      color: '#ddd',
                      cursor: isSubmitting || !feedback.trim() ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    건의사항만 보내기
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                <label 
                  htmlFor="phone" 
                  style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                  휴대전화번호 (숫자만 입력)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="01012345678"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    backgroundColor: '#fff',
                    color: '#333',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <label className="checkbox-label" style={{ alignItems: 'flex-start', marginBottom: '20px' }}>
                <input 
                  type="checkbox" 
                  checked={isAgreed} 
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  style={{ marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.85rem', lineHeight: '1.4', color: '#ccc' }}>
                  <b>[개인정보 수집 동의]</b> 이벤트 경품 발송을 위해 휴대전화번호를 수집하며, 
                  목적 달성(경품 발송) 후 즉시 폐기됩니다. 동의하지 않을 경우 경품 추첨에서 제외될 수 있습니다.
                </span>
              </label>

              <button 
                className="primary-button"
                type="button"
                onClick={handleSubmitContact}
                disabled={isSubmitting}
                style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
              >
                {isSubmitting ? '저장 중...' : '동의하고 응모하기'}
              </button>
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
              border: '1px solid rgba(34, 197, 94, 0.3)', 
              borderRadius: '12px',
              marginTop: '20px'
            }}>
              <h3 style={{ color: '#4ade80', marginBottom: '5px' }}>✅ 응모 완료</h3>
              <p style={{ fontSize: '0.9rem', color: '#eee' }}>
                소중한 의견과 전화번호가 안전하게 저장되었습니다.<br/>
                당첨 시 문자로 안내드리겠습니다.
              </p>
            </div>
          )}
        </section>

        <div className="consent-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
          <button 
            className="secondary-button" 
            type="button" 
            onClick={handleGoHome}
            style={{ width: '100%', maxWidth: '300px' }}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;