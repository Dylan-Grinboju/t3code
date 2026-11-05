import { ChevronDownIcon } from "lucide-react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { useSidebar } from "../ui/sidebar";

export function SidebarDisplayOptions() {
  const { displayMode, setDisplayMode, hoverEnabled, setHoverEnabled, isMobile } = useSidebar();
  if (isMobile) return null;

  return (
    <Menu>
      <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label="Sidebar options" />}>
        <ChevronDownIcon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuRadioGroup
          value={displayMode}
          onValueChange={(mode) => {
            if (mode === "expanded" || mode === "strip" || mode === "closed") setDisplayMode(mode);
          }}
        >
          <MenuRadioItem closeOnClick value="expanded">
            Open
          </MenuRadioItem>
          <MenuRadioItem closeOnClick value="strip">
            Status strip
          </MenuRadioItem>
          <MenuRadioItem closeOnClick value="closed">
            Closed
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuCheckboxItem closeOnClick checked={hoverEnabled} onCheckedChange={setHoverEnabled}>
          Reveal on left-edge hover
        </MenuCheckboxItem>
      </MenuPopup>
    </Menu>
  );
}
