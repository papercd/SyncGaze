import { Link } from 'react-router-dom';
import ProfileCard from '../components/Profilecard';
import './AboutPage.css';

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
    handle: 'member2',
    avatarUrl: '/avatars/Nokyom.jpg', //'https://via.placeholder.com/400x600',
    status: 'Data Analysis Expert',
    bio: 'Specializing in data analytics and backend infrastructure.',
    email: 'member2@example.com',
    github: 'https://github.com/member2',
    },
    {
    name: 'Juhwan Lee',
    title: 'Lead Developer',
    handle: 'yourhandle',
    avatarUrl: '/avatars/Juwhan.jpg', //'https://via.placeholder.com/400x600',
    status: 'Building SyncGaze',
    bio: 'Passionate about eye tracking and game performance analysis.',
    email: 'yourname@example.com',
    github: 'https://github.com/yourhandle',
  },


  {
    name: 'Woojoung Lee',
    title: 'Backend Developer',
    handle: 'member2',
    avatarUrl: 'https://via.placeholder.com/400x600',
    status: 'Data Analysis Expert',
    bio: 'Specializing in data analytics and backend infrastructure.',
    email: 'member2@example.com',
    github: 'https://github.com/member2',
  },
  // Add more team members here
];

const AboutPage = () => {
  const handleContactClick = (member: TeamMember) => {
    if (member.email) {
      window.location.href = `mailto:${member.email}`;
    }
  };

  return (
    <div className="about-page">
      <div className="about-header">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>
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
              showUserInfo={true}
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
    </div>
  );
};

export default AboutPage;