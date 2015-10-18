$.fn.ktable = function( options ) {
  /**
    jQuery plugin for generating tables based on JSON
    
    This plugin builds a HTML table and populate it with JSON retreived from an ajax request.
    The retrieved JSON object MUST contain these elements: "response", "responsecode", "payload" (see example #2 below).
    The table will only be build, if the responsecode is 200.
    
    @author                       Kasper Leth Jensen <kasper.leth.jensen@gmail.com>
    
    @requirements:                jQquery (Build on 1.11.3, but it will probably work on later versions as well)
    
    @param source                 [string]    The URL of the JSON file.
    @param columns                [object]    The columns to show in the table - will be shown in that order as well.
                                              The key name must refer to the name in the JSON object.
      @param label                [string]    What will be shown in the header for this column
      @param sortable             [bool]      If this column should be sortable (optional)
      @param sorted               [enum]      If this setting is present, the column will be sorted. (optional)
                                              Valid values are: "asc" (for ascending), "desc" (for descending)
                                              If no columns are marked as sorted, the table will be sorted by the first column.
                                              If more than one column are are as sorted, only the last will be used. 
                                
    @param settings               [object]    List of settings for the table (optional)
      @param css_class_asc        [string]    CSS class name for the ascending icon. No text will be used in the icon, so the CSS class is needed to show anything (optional)
      @param css_class_desc       [string]    CSS class name for the descending icon. (optional)
      @param css_class_notsorted  [string]    CSS class name for the icon on columns that is not sorted (but has "sortable: true"). (optional)
      
    @param icons                  [array]     Array of icons to custom show on each row. (optional)  
      @param css_class            [string]    CSS class that will be assigned to the icon. No text will be used in the icon, so the CSS class is needed to show anything (optional)
      @param title                [string]    The title of the link. Used when hovering the icon. (optional)
      @param href                 [string]    Url of the link. Placeholders can be used, to insert values from the JSON object.
                                              Placeholders are defined by surrounding a name from the JSON object with "%%"
                                              Example: index.php?book_id=%%id%% (this will parse the value of item "id" from the row)
                                              
    
    Example #1: using the plugin:
    
      $("#table-of-books").table({
          "source": "/books.json",
          "columns": {
            "name": {
              "label": "Name",
              "sortable": true,
              "sorted": "asc"
            },
            [...]
          },
          "settings": {
            "css_class_asc": "flaticon-sort6",
            [...]
          },
          "icons": [
            {
              "css_class": "flaticon-settings48",
              "title": "Edit",
              "href": "/edit.php?book_id=%%id%%"
            },
            [...]
          ]
        });
        
    Example #2: The JSON object returned by the specified URL:
    
      {
        "response": "OK",
        "responsecode": 200,
        "payload": [
          {
            "id": "1",
            "name": "The Hitchhiker's Guide to the Galaxy",
            "author": "Douglas Adams",
            "year": "1979"
          },
          [...]
        ]
      }
   */
  
  /**
    Define global variables
   */
   
  var opts = $.extend( {}, $.fn.table.defaults, options ),
    _this = $(this),
    _data = {},
    table = $("<table></table>"),
    thead = $("<thead></thead>"),
    tbody = $("<tbody></tbody>"),
    thead_tr = $("<tr></tr>"),
    sort_by = "",
    sort_desc = false;
    first_column = "";

    
  /**
    Function to build the <thead> for the table.
    This function will be called only once, when the table is initially created.
    
    If one or more icons are specified, an empty column will be added as the last header,
    as there will be added an extra cell to each row, containing the icons. This cell
    is having an inline CSS attribute, "width: 1px", to ensure it is as narrow as possible.
    
    If a column has the "sortable" parameter set, a link is placed right after the header
    text. Inside it will be a span element, having the CSS class specified in
    settings.css_class_asc, settings.css_class_desc or settings.css_class_notsorted,
    depending on if the column is sorted and how.
    
    Unlike the tbody of the table, the thead will not be reparsed each time the sorting
    is changed in the table.
    
    The HTML structure:
    
    <table>
      <thead>
        <tr>
          <th>Column 1</th>
          [...]
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Cell 1</td>
          [...]
        </tr>
      </tbody>
    </table>
   */
   
  function buildHeaders () {
    $.each( opts.columns, function( column_ident, column ){
      var th = $("<th></th>");
      
      if ( first_column == "" )
        first_column = column_ident;
      
      if ( column.sorted !== undefined ) {
        if ( column.sorted == "desc" ) {
          sort_by = column_ident;
          sort_desc = true;
        } else {
          sort_by = column_ident;
          sort_desc = false;
        }
      }
      
      if ( column.sortable !== undefined && column.sortable == true ) {
        var link = $("<a></a>");
        var icon = $("<span></span>");
        
        link.text(column.label);
        link.attr("href", "#");
        link.attr("data-column-ident", column_ident);
        
        link.append(icon);
        
        link.on("click", function(e){
          e.preventDefault();
          
          if ( sort_by == column_ident ) {
            sort_desc = !sort_desc;
          } else {
            sort_by = column_ident;
            sort_desc = false;
          }
          buildTable();
        });
        th.append(link);
      } else {
        th.html(column.label);
      }
      thead_tr.append(th);
    });
    
    if ( opts.icons !== undefined && Object.keys(opts.icons).length > 0 ) {
      var th = $("<th></th>");
      th.css("width", "1px");
      thead_tr.append(th);
    }
  }

  
  /**
    Function to update the column sorting icons in <thead>.
    
    This function is called each time the user presses one of the sorting
    icons.
    
    Pseudo code:
      1. Remove all CSS classes from all the sorting icons
      2. Add the CSS class "notsorted" to all the sorting icons
      3. Replace the CSS class of the icon in the column that are sorted
        a. Set is to "css_class_asc" if the sorting is ascending
        b. Set is to "css_class_desc" if the sorting is descending
   */

  function updateColumnSortIcons () {
    if ( opts.settings.css_class_asc == undefined || opts.settings.css_class_desc == undefined ) {
      return;
    }
    
    table.find("thead th a[data-column-ident] span").removeClass();
    
    if ( opts.settings.css_class_notsorted !== undefined ) {
      table.find("thead th a[data-column-ident] span").addClass(opts.settings.css_class_notsorted);
    }
    
    var icon_class = ( sort_desc==true ? opts.settings.css_class_desc : opts.settings.css_class_asc );
    table.find("thead th a[data-column-ident=" + sort_by + "] span").removeClass().addClass(icon_class);
  }


  /**
    Function that build the <tbody> of the table
    
    This function is called when the table is initialized, and each time the user
    change the sorting.
    
    When the function is called, it starts by clearing the container and updating the
    sorting icons in the <thead> section.
    
    The actual sorting of the JSON object is performed by this function.
    
    If one or more custom icons are specified, there will be added an extra cell to
    the end of each row, in where the icons are placed. That cell is having an inline
    CSS attribute "white-space: nowrap" to prevent line-breaks between the icons.
   */

  function buildTable () {
    tbody.empty();
    updateColumnSortIcons();
    _data.payload.sort(function (a, b){
      
      var astr = a[sort_by].toLowerCase();
      var bstr = b[sort_by].toLowerCase(); 
      
      return (
        (astr < bstr)
          ? ( sort_desc == true ? 1 : -1 )
          : (
            (astr > bstr)
              ? ( sort_desc == true ? -1 : 1 )
              : 0
          )
      );
    });
    
    $.each( _data.payload, function( index, data ) {
      var row = $("<tr></tr>");
      $.each( opts.columns, function( column_ident, column ){
        if ( data[column_ident] !== undefined ) {
          var cell = $("<td></td>");
          var label = data[column_ident];
          cell.text(label);
          row.append(cell);
        }
        tbody.append(row);
      });
      
      if ( opts.icons !== undefined && Object.keys(opts.icons).length > 0 ) {
        var cell_icons = $("<td></td>");
        cell_icons.css("white-space", "nowrap");
        
        $.each( opts.icons, function( index, icon ) {
          var span = $("<span></span>");
          var link = $("<a></a>");
          
          if ( icon.css_class !== undefined )
            span.addClass(icon.css_class);
          
          if ( icon.title !== undefined )
            span.attr("title", icon.title);
          
          if ( icon.href !== undefined ) {
            var href = icon.href;
            
            $.each(opts.columns, function( i, c ){
              href = href.replace("%%" + i + "%%", data[i]);
            });
            
            link.attr("href", href);
            link.append(span);
            cell_icons.append(link);
          } else {
            cell_icons.append(span);
          }
        });
        
        row.append(cell_icons);
      }
    });
  }
  
  if ( sort_by == "" )      // If no sort_by is set (no column marked with "sorted"), the first column will be used.
    sort_by = first_column;
  
  // Append the HTML elements:
  thead.append(thead_tr);
  table.append(thead);
  table.append(tbody);
  this.append(table);
  
  // Retrieve the JSON object from the "url" parameter
  $.getJSON(opts.source, function( data ) {
    if ( data.responsecode == 200 ) {
      console.debug("jsonapi response: " + data.responsecode + " (" + data.response + ")");
      _data = data;
      buildHeaders();
      buildTable();
    } else {
      if ( data.response == undefined )
        data.response = "UNKNOWN";
      
      console.error("jsonapi returned an error: " + data.responsecode + " (" + data.response + ")");
      console.error(data);
    }
  })
  .fail(function( jqxhr, textStatus, error ) {
    var err = textStatus + ", " + error;
    console.log( "JSON request failed: " + err );
  });
};

$.fn.table.defaults = {};