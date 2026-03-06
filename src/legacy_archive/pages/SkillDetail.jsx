
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import SkillContent from '../components/SkillContent';

const SkillDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { state } = useStore();

    const skill = state.skills[id];
    const area = skill ? state.areas[skill.areaId] : null;

    if (!skill) return <div style={{ padding: '2rem' }}>Skill not found</div>;

    return (
        <div className="skill-detail" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Breadcrumb & Header */}
            <div style={{ marginBottom: '12px' }}>
                <button
                    onClick={() => navigate(area ? `/area/${area.id}` : '/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        marginBottom: 'var(--spacing-sm)'
                    }}
                >
                    <ArrowLeft size={16} /> Back to {area?.name}
                </button>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0, fontWeight: '800', color: '#fff' }}>{skill.name}</h1>
            </div>

            {/* Reusable Skill Content */}
            <SkillContent skillId={id} />
        </div>
    );
};

export default SkillDetail;
