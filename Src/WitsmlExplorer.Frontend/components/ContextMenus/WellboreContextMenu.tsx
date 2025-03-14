import { Typography } from "@equinor/eds-core-react";
import { Divider, MenuItem } from "@material-ui/core";
import {
  ObjectTypeToTemplateObject,
  StoreFunction,
  TemplateObjects
} from "components/ContentViews/QueryViewUtils";
import { WellboreRow } from "components/ContentViews/WellboresListView";
import ContextMenu from "components/ContextMenus/ContextMenu";
import {
  StyledIcon,
  menuItemText
} from "components/ContextMenus/ContextMenuUtils";
import { pasteObjectOnWellbore } from "components/ContextMenus/CopyUtils";
import NestedMenuItem from "components/ContextMenus/NestedMenuItem";
import { useClipboardReferences } from "components/ContextMenus/UseClipboardReferences";
import ConfirmModal from "components/Modals/ConfirmModal";
import DeleteEmptyMnemonicsModal, {
  DeleteEmptyMnemonicsModalProps
} from "components/Modals/DeleteEmptyMnemonicsModal";
import LogPropertiesModal, {
  IndexCurve,
  LogPropertiesModalInterface
} from "components/Modals/LogPropertiesModal";
import MissingDataAgentModal, {
  MissingDataAgentModalProps
} from "components/Modals/MissingDataAgentModal";
import { PropertiesModalMode } from "components/Modals/ModalParts";
import WellborePropertiesModal, {
  WellborePropertiesModalProps
} from "components/Modals/WellborePropertiesModal";
import ModificationType from "contexts/modificationType";
import NavigationContext from "contexts/navigationContext";
import { treeNodeIsExpanded } from "contexts/navigationStateReducer";
import NavigationType from "contexts/navigationType";
import OperationContext from "contexts/operationContext";
import { DisplayModalAction } from "contexts/operationStateReducer";
import OperationType from "contexts/operationType";
import { useOpenInQueryView } from "hooks/useOpenInQueryView";
import { DeleteWellboreJob } from "models/jobs/deleteJobs";
import LogObject from "models/logObject";
import { ObjectType } from "models/objectType";
import { Server } from "models/server";
import Well from "models/well";
import Wellbore, { calculateWellboreNodeId } from "models/wellbore";
import React, { useContext } from "react";
import JobService, { JobType } from "services/jobService";
import ObjectService from "services/objectService";
import WellboreService from "services/wellboreService";
import { colors } from "styles/Colors";
import { v4 as uuid } from "uuid";

export interface WellboreContextMenuProps {
  wellbore: Wellbore;
  well: Well;
  checkedWellboreRows?: WellboreRow[];
}

const WellboreContextMenu = (
  props: WellboreContextMenuProps
): React.ReactElement => {
  const { wellbore, well, checkedWellboreRows } = props;
  const {
    dispatchNavigation,
    navigationState: {
      servers,
      expandedTreeNodes,
      selectedWell,
      selectedWellbore
    }
  } = useContext(NavigationContext);
  const { dispatchOperation } = useContext(OperationContext);
  const openInQueryView = useOpenInQueryView();
  const objectReferences = useClipboardReferences();

  const onClickNewWellbore = () => {
    const newWellbore: Wellbore = {
      uid: uuid(),
      name: "",
      wellUid: wellbore.wellUid,
      wellName: wellbore.wellName,
      wellStatus: "",
      wellType: "",
      isActive: false,
      wellboreParentUid: wellbore.uid,
      wellboreParentName: wellbore.name,
      wellborePurpose: "unknown"
    };
    const wellborePropertiesModalProps: WellborePropertiesModalProps = {
      mode: PropertiesModalMode.New,
      wellbore: newWellbore,
      dispatchOperation
    };
    const action: DisplayModalAction = {
      type: OperationType.DisplayModal,
      payload: <WellborePropertiesModal {...wellborePropertiesModalProps} />
    };
    dispatchOperation(action);
  };

  const onClickNewLog = () => {
    const newLog: LogObject = {
      uid: uuid(),
      name: "",
      wellUid: wellbore.wellUid,
      wellName: wellbore.wellName,
      wellboreUid: wellbore.uid,
      wellboreName: wellbore.name,
      indexCurve: IndexCurve.Depth
    };
    const logPropertiesModalProps: LogPropertiesModalInterface = {
      mode: PropertiesModalMode.New,
      logObject: newLog,
      dispatchOperation
    };
    const action: DisplayModalAction = {
      type: OperationType.DisplayModal,
      payload: <LogPropertiesModal {...logPropertiesModalProps} />
    };
    dispatchOperation(action);
  };

  const deleteWellbore = async () => {
    dispatchOperation({ type: OperationType.HideContextMenu });
    dispatchOperation({ type: OperationType.HideModal });
    const job: DeleteWellboreJob = {
      toDelete: {
        wellUid: wellbore.wellUid,
        wellboreUid: wellbore.uid,
        wellName: wellbore.wellName,
        wellboreName: wellbore.name
      }
    };
    await JobService.orderJob(JobType.DeleteWellbore, job);
  };

  const onClickDelete = async () => {
    const confirmation = (
      <ConfirmModal
        heading={"Delete wellbore?"}
        content={
          <span>
            This will permanently delete <strong>{wellbore.name}</strong> with
            uid: <strong>{wellbore.uid}</strong>
          </span>
        }
        onConfirm={deleteWellbore}
        confirmColor={"danger"}
        confirmText={"Delete wellbore"}
        switchButtonPlaces={true}
      />
    );
    dispatchOperation({
      type: OperationType.DisplayModal,
      payload: confirmation
    });
  };

  const onClickDeleteEmptyMnemonics = async () => {
    const deleteEmptyMnemonicsModalProps: DeleteEmptyMnemonicsModalProps = {
      wellbores: [wellbore]
    };
    const action: DisplayModalAction = {
      type: OperationType.DisplayModal,
      payload: <DeleteEmptyMnemonicsModal {...deleteEmptyMnemonicsModalProps} />
    };
    dispatchOperation(action);
  };

  const onClickRefresh = async () => {
    dispatchOperation({ type: OperationType.HideContextMenu });
    // toggle the wellbore node and navigate to parent wellbore to reset the sidebar and content view
    //   because we do not load in objects that have been loaded in before the refresh
    const nodeId = calculateWellboreNodeId(wellbore);
    if (treeNodeIsExpanded(expandedTreeNodes, nodeId)) {
      dispatchNavigation({
        type: NavigationType.CollapseTreeNodeChildren,
        payload: { nodeId }
      });
    }
    if (
      selectedWell?.uid == well.uid &&
      selectedWellbore?.uid == wellbore.uid
    ) {
      dispatchNavigation({
        type: NavigationType.SelectWellbore,
        payload: { well, wellbore }
      });
    }

    const refreshedWellbore = await WellboreService.getWellbore(
      wellbore.wellUid,
      wellbore.uid
    );
    const objectCount = await ObjectService.getExpandableObjectsCount(wellbore);
    dispatchNavigation({
      type: ModificationType.UpdateWellbore,
      payload: { wellbore: { ...refreshedWellbore, objectCount } }
    });
  };

  const onClickMissingDataAgent = () => {
    const wellboreReferences = checkedWellboreRows?.map((row) => ({
      wellUid: row.wellUid,
      wellboreUid: row.uid,
      wellName: row.wellName,
      wellboreName: row.name
    })) || [
      {
        wellUid: wellbore.wellUid,
        wellboreUid: wellbore.uid,
        wellName: wellbore.wellName,
        wellboreName: wellbore.name
      }
    ];
    const missingDataAgentModalProps: MissingDataAgentModalProps = {
      wellReferences: [],
      wellboreReferences: wellboreReferences
    };
    dispatchOperation({
      type: OperationType.DisplayModal,
      payload: <MissingDataAgentModal {...missingDataAgentModalProps} />
    });
  };

  const onClickProperties = async () => {
    const controller = new AbortController();
    const detailedWellbore = await WellboreService.getWellbore(
      wellbore.wellUid,
      wellbore.uid,
      controller.signal
    );
    const wellborePropertiesModalProps: WellborePropertiesModalProps = {
      mode: PropertiesModalMode.Edit,
      wellbore: detailedWellbore,
      dispatchOperation
    };
    dispatchOperation({
      type: OperationType.DisplayModal,
      payload: <WellborePropertiesModal {...wellborePropertiesModalProps} />
    });
  };

  const onClickShowOnServer = async (server: Server) => {
    dispatchOperation({ type: OperationType.HideContextMenu });
    const host = `${window.location.protocol}//${window.location.host}`;
    const wellboreUrl = `${host}/?serverUrl=${server.url}&wellUid=${wellbore.wellUid}&wellboreUid=${wellbore.uid}`;
    window.open(wellboreUrl);
  };

  return (
    <ContextMenu
      menuItems={[
        <MenuItem key={"refreshwellbore"} onClick={onClickRefresh}>
          <StyledIcon
            name="refresh"
            color={colors.interactive.primaryResting}
          />
          <Typography color={"primary"}>Refresh wellbore</Typography>
        </MenuItem>,
        <MenuItem key={"newwellbore"} onClick={onClickNewWellbore}>
          <StyledIcon name="add" color={colors.interactive.primaryResting} />
          <Typography color={"primary"}>New wellbore</Typography>
        </MenuItem>,
        <MenuItem key={"newlog"} onClick={onClickNewLog}>
          <StyledIcon name="add" color={colors.interactive.primaryResting} />
          <Typography color={"primary"}>New log</Typography>
        </MenuItem>,
        <MenuItem
          key={"paste"}
          onClick={() =>
            pasteObjectOnWellbore(
              servers,
              objectReferences,
              dispatchOperation,
              wellbore
            )
          }
          disabled={objectReferences === null}
        >
          <StyledIcon name="paste" color={colors.interactive.primaryResting} />
          <Typography color={"primary"}>
            {menuItemText(
              "paste",
              objectReferences?.objectType ?? "",
              objectReferences?.objectUids
            )}
          </Typography>
        </MenuItem>,
        <MenuItem key={"deleteWellbore"} onClick={onClickDelete}>
          <StyledIcon
            name="deleteToTrash"
            color={colors.interactive.primaryResting}
          />
          <Typography color={"primary"}>Delete</Typography>
        </MenuItem>,
        <MenuItem
          key={"deleteEmptyMnemonics"}
          onClick={onClickDeleteEmptyMnemonics}
        >
          <StyledIcon
            name="deleteToTrash"
            color={colors.interactive.primaryResting}
          />
          <Typography color={"primary"}>Delete empty mnemonics</Typography>
        </MenuItem>,
        <NestedMenuItem key={"showOnServer"} label={"Show on server"}>
          {servers.map((server: Server) => (
            <MenuItem
              key={server.name}
              onClick={() => onClickShowOnServer(server)}
            >
              <Typography color={"primary"}>{server.name}</Typography>
            </MenuItem>
          ))}
        </NestedMenuItem>,
        <NestedMenuItem key={"queryItems"} label={"Query"} icon="textField">
          {[
            <MenuItem
              key={"openQuery"}
              onClick={() =>
                openInQueryView({
                  templateObject: TemplateObjects.Wellbore,
                  storeFunction: StoreFunction.GetFromStore,
                  wellUid: well.uid,
                  wellboreUid: wellbore.uid
                })
              }
            >
              <StyledIcon
                name="textField"
                color={colors.interactive.primaryResting}
              />
              <Typography color={"primary"}>Open in query view</Typography>
            </MenuItem>,
            <MenuItem
              key={"newWellbore"}
              onClick={() =>
                openInQueryView({
                  templateObject: TemplateObjects.Wellbore,
                  storeFunction: StoreFunction.AddToStore,
                  wellUid: well.uid,
                  wellboreUid: uuid()
                })
              }
            >
              <StyledIcon
                name="add"
                color={colors.interactive.primaryResting}
              />
              <Typography color={"primary"}>New Wellbore</Typography>
            </MenuItem>,
            <NestedMenuItem
              key={"newObjects"}
              label={"New object"}
              icon={"add"}
            >
              {Object.values(ObjectType).map((objectType) => (
                <MenuItem
                  key={objectType}
                  onClick={() =>
                    openInQueryView({
                      templateObject: ObjectTypeToTemplateObject[objectType],
                      storeFunction: StoreFunction.AddToStore,
                      wellUid: well.uid,
                      wellboreUid: wellbore.uid,
                      objectUid: uuid()
                    })
                  }
                >
                  <StyledIcon
                    name="add"
                    color={colors.interactive.primaryResting}
                  />
                  <Typography
                    color={"primary"}
                  >{`New ${objectType}`}</Typography>
                </MenuItem>
              ))}
            </NestedMenuItem>
          ]}
        </NestedMenuItem>,
        <MenuItem key={"missingDataAgent"} onClick={onClickMissingDataAgent}>
          <StyledIcon name="search" color={colors.interactive.primaryResting} />
          <Typography color={"primary"}>Missing Data Agent</Typography>
        </MenuItem>,
        <Divider key={"divider"} />,
        <MenuItem key={"properties"} onClick={onClickProperties}>
          <StyledIcon
            name="settings"
            color={colors.interactive.primaryResting}
          />
          <Typography color={"primary"}>Properties</Typography>
        </MenuItem>
      ]}
    />
  );
};

export default WellboreContextMenu;
