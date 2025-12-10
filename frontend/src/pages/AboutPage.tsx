import ProfileCard from '../components/ProfileCard';
import Navbar from '../components/TopNavBar';
import './AboutPage.css';
import { useTranslation } from '../state/languageContext';

interface TeamMember {
  name: string;
  title: string;
  handle: string;
  avatarUrl: string;
  status: string;
  bio?: string;
  email?: string;
  github?: string;
  linkedin?: string;
}

// TODO: Replace with actual team member data
const teamMembers: TeamMember[] = [
  {
    name: 'Nokyom Kang',
    title: 'Backend Developer',
    handle: 'papercd',
    avatarUrl: '/avatars/Nokyom.jpg',
    status: 'Data Analysis Expert',
    bio: 'Aspiring developer who loves game related content',
    email: 'member2@example.com',
    github: 'https://github.com/papercd',
  },
  {
    name: 'Juhwan Lee',
    title: 'Lead Developer',
    handle: 'JuhwanLee99',
    avatarUrl: '/avatars/Juwhan.jpg',
    status: 'Building SyncGaze',
    bio: 'Passionate about eye tracking and game performance analysis.',
    email: 'yourname@example.com',
    github: 'https://github.com/JuhwanLee99',
  },
  {
    name: 'Woojoung Lee',
    title: 'Backend Developer',
    handle: 'wjyi0615',
    avatarUrl: '/avatars/Woojoung.jpg',
    status: 'Data Analysis Expert',
    bio: 'Specializing in data analytics and backend infrastructure.',
    email: 'member2@example.com',
    github: 'https://github.com/wjyi0615',
  },
];

const AboutPage = () => {
  const { t } = useTranslation();
  const handleContactClick = (member: TeamMember) => {
    if (member.email) {
      window.location.href = `mailto:${member.email}`;
    }
  };

  return (
    <div className="about-page">
      
      <Navbar showAuthButton={true} />
      <div className="about-header">
        
        <div className="about-title-section">
          <h1>Meet the Team</h1>
          <p className="about-subtitle">
            The developers behind SyncGaze - your eye tracking training companion
          </p>
        </div>
      </div>

      <div className="team-grid">
        {teamMembers.map((member, index) => (
          <div key={index} className="team-member">
            <ProfileCard
              avatarUrl={member.avatarUrl}
              name={member.name}
              title={member.title}
              handle={member.handle}
              status={member.status}
              contactText="Contact"
              showUserInfo={false}
              enableTilt={true}
              enableMobileTilt={false}
              onContactClick={() => handleContactClick(member)}
              behindGlowEnabled={true}
              behindGlowColor="rgba(125, 190, 255, 0.67)"
            />
            
            {member.bio && (
              <div className="member-bio">
                <p>{member.bio}</p>
                <div className="member-links">
                  {member.github && (
                    <a 
                      href={member.github} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="social-link"
                    >
                      GitHub
                    </a>
                  )}
                  {member.linkedin && (
                    <a 
                      href={member.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="social-link"
                    >
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="about-footer">
        <div className="about-project">
          <h2>About SyncGaze</h2>
          <p>
            SyncGaze is an innovative eye tracking training platform designed to help gamers 
            improve their aim and performance through advanced eye tracking technology and 
            real-time feedback.
          </p>
        </div>
      </div>

      <footer className="about-github-footer">
        <p className="about-github-link">
          <a href="https://github.com/papercd/SyncGaze" target="_blank" rel="noreferrer">
            {t('landing.footer.githubLine', '이 프로젝트의 GitHub 저장소를 확인하려면 여기를 클릭하세요.')}
          </a>
        </p>
      </footer>
    </div>
  );
};

export default AboutPage;
