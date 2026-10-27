import CaseworkPageLayout from '../../components/casework-tools/CaseworkPageLayout'
import CaseworkToolWorkspace from '../../components/casework-tools/CaseworkToolWorkspace'
import { caseworkTools } from '../../casework-tools/tools'

function CaseManagementIntegrationsPage() {
  const tool = caseworkTools.find((item) => item.id === 'integrations')
  return (
    <CaseworkPageLayout tool={tool}>
      <CaseworkToolWorkspace tool={tool} />
    </CaseworkPageLayout>
  )
}

export default CaseManagementIntegrationsPage
