import { useApplyDraft } from '../../flow/hooks/useApplyDraft'
import { useApplyStep } from '../../flow/hooks/useApplyStep'
import { useApplySubmit } from '../../flow/hooks/useApplySubmit'
import IdentityStep from './IdentityStep'
import LogoStep from './LogoStep'
import StoryStep from './StoryStep'
import TypeStep from './TypeStep'

type Props = { accountRef: string }

export default function ApplyFlow({ accountRef }: Props) {
  const { currentStep, canContinue, nextStep, previousStep } = useApplyStep()
  const { draft, updateField } = useApplyDraft(accountRef)
  const { submitting, submitError, submit } = useApplySubmit(accountRef)

  return (
    <section className='apply-card'>
      <div className='apply-steps' aria-label={`Step ${currentStep + 1} of 4`}>
        {[0, 1, 2, 3].map((step) => (
          <span
            className={`apply-step ${step <= currentStep ? 'apply-step-active' : ''}`}
            key={step}
          />
        ))}
      </div>
      {currentStep === 0 ? (
        <TypeStep
          value={draft.communityType}
          onChange={(value) => updateField('communityType', value)}
        />
      ) : null}
      {currentStep === 1 ? (
        <IdentityStep
          title={draft.title}
          slug={draft.slug}
          onTitleChange={(value) => updateField('title', value)}
          onSlugChange={(value) => updateField('slug', value)}
        />
      ) : null}
      {currentStep === 2 ? (
        <StoryStep
          desc={draft.desc}
          message={draft.applyMessage}
          onDescChange={(value) => updateField('desc', value)}
          onMessageChange={(value) => updateField('applyMessage', value)}
        />
      ) : null}
      {currentStep === 3 ? (
        <LogoStep
          logoUrl={draft.logoUrl}
          onUploaded={(ref, url) => {
            updateField('logoAssetRef', ref)
            updateField('logoUrl', url)
          }}
        />
      ) : null}
      {submitError ? <p className='apply-error'>{submitError}</p> : null}
      <div className='apply-actions'>
        <button
          className='apply-button apply-secondary'
          type='button'
          disabled={currentStep === 0 || submitting}
          onClick={previousStep}
        >
          Back
        </button>
        {currentStep < 3 ? (
          <button
            className='apply-button apply-primary'
            type='button'
            disabled={!canContinue}
            onClick={nextStep}
          >
            Continue
          </button>
        ) : (
          <button
            className='apply-button apply-primary'
            type='button'
            disabled={!canContinue || submitting}
            onClick={() => void submit()}
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        )}
      </div>
    </section>
  )
}
